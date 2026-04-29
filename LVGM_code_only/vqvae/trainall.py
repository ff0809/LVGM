import argparse
import datetime
import json
import numpy as np
import os
import time
import math
import sys

from pathlib import Path
import torch
import torch.backends.cudnn as cudnn
import torchvision.transforms as transforms
import torchvision.datasets as datasets

from typing import Iterable, Optional

from dataset import MyDataset_stage_one as MyDataset_stage_one_old
from datasetnorm import MyDataset_stage_one as MyDataset_stage_one_new
from model import Encoder_stage_one, Decoder_stage_one
from scaler import NativeScalerWithGradNormCount as NativeScaler
from utils import requires_grad, L1_loss, L2_loss
from torch.utils.tensorboard import SummaryWriter

def get_args_parser():
    parser = argparse.ArgumentParser('Stage one Training')
    parser.add_argument('--epochs', default = 2000, type = int, help = 'Training rounds')
    parser.add_argument('--batch_size', default = 128, type = int, help = 'Batch size per GPU')
    parser.add_argument('--device', default = 'cuda', help = 'Device to use for training / testing')

    parser.add_argument('--canvas_size', default= 1024, type=int, help= 'Canvas size of SVG')
    parser.add_argument('--fixed_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')

    parser.add_argument('--learning_rate', default=3e-4, type=float, metavar = 'LR', help = 'Learning rate (absolute lr)')
    parser.add_argument('--svg_path', default='D:/矢量字体生成项目/data/makemeahanzi-master/makemeahanzi-master/svgs', help = 'SVG saved dir')
    parser.add_argument('--output_dir', default='output_dir', help='Path where to save, empty for no saving')

    parser.add_argument('--start_epoch', default = 0, type = int, help = 'Start epoch')
    parser.add_argument('--resume', default = None, metavar = 'Resume', help = 'Resume from checkpoint')

    parser.add_argument('--log_dir', default='log', help='log dir')

    return parser

def main(args):
    log = SummaryWriter(args.log_dir)
    device = torch.device(args.device)
    cudnn.benchmark = True

    dataset = MyDataset_stage_one_old('/home/user/latest/codeanddata/svg/svgs', args.fixed_length, True)
    sampler = torch.utils.data.RandomSampler(dataset)
    data_loader_train_old = torch.utils.data.DataLoader(
        dataset = dataset,
        batch_size = args.batch_size,
        sampler = sampler,
        drop_last = True
    )

    dataset = MyDataset_stage_one_new('/home/user/latest/codeanddata/newdata', args.fixed_length, True)
    sampler = torch.utils.data.RandomSampler(dataset)
    data_loader_train_new = torch.utils.data.DataLoader(
        dataset = dataset,
        batch_size = args.batch_size,
        sampler = sampler,
        drop_last = True
    )

    encoder = Encoder_stage_one()
    encoder.to(device)
    decoder = Decoder_stage_one()
    decoder.to(device)

    optimizer = torch.optim.AdamW(list(encoder.parameters())+list(decoder.parameters()), lr = args.learning_rate)
    loss_scaler = NativeScaler()

    if args.resume is not None:
        checkpoint = torch.load(args.resume, map_location='cpu')

        encoder.load_state_dict(checkpoint['encoder'])
        decoder.load_state_dict(checkpoint['decoder'])

        optimizer.load_state_dict(checkpoint['optimizer'])
        loss_scaler.load_state_dict(checkpoint['loss_scaler'])
        args.start_epoch = checkpoint['epoch'] + 1
        print("With optim & sched!")
    
    encoder.train(mode=True)
    decoder.train(mode=True)
    requires_grad(encoder, True)
    requires_grad(decoder, True)

    mse_loss = torch.nn.MSELoss()
    mae_loss = torch.nn.L1Loss()
    
    print(f"Start training for {args.epochs} epochs")
    start_time = time.time()
    for epoch in range(args.start_epoch, args.epochs):

        print('Epoch: [{}]'.format(epoch))

        cnt = 0
        loss_sum = 0
        l1loss_sum = 0
        l2loss_sum = 0

        for data_iter_step, (strokes) in enumerate(zip(data_loader_train_old, data_loader_train_new)):

            strokes = strokes.to(device) # 64*6 
            B, _, _ = strokes.shape
            strokes = strokes.reshape(B, 6, 8, 8) # 6*8*8
            optimizer.zero_grad()
            # print(strokes.size())
            stroke_encode, stroke_vq, emb_loss = encoder(strokes, device)
            # print(stroke_encode.shape)
            # print(stroke_vq.shape)
            strokes_pred = decoder(stroke_vq)
            # print(strokes_pred.shape)

            rec_loss = mae_loss(strokes, strokes_pred)
            loss = rec_loss + emb_loss

            loss_value = loss.item()
            # print(loss_value)

            if not math.isfinite(loss_value):
                print("Loss is {}, stopping training".format(loss_value))
                sys.exit(1)            

            # optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            # decoder_optimizer.zero_grad()            
            # encoder_loss_scaler(loss, encoder_optimizer, parameters = encoder.parameters(), update_grad = True)
            # loss_scaler(loss, optimizer, parameters = list(encoder.parameters())+list(decoder.parameters()), update_grad = True)

            cnt += 1
            loss_sum += loss_value
            # l1loss_sum += l1loss.item()
            # l2loss_sum += l2loss.item()
            # print("Loss is {}. L1 Loss {}. L2 Loss".format(loss_sum / cnt * 1000, l1loss_sum / cnt * 1000))

        print("Loss is {}.".format(loss_sum / cnt))
        log.add_scalar('train/loss', loss_sum / cnt, epoch)
        # print("Loss is {}. L1 Loss {}. L2 Loss {}".format(loss_sum / cnt * 1000, l1loss_sum / cnt * 1000, l2loss_sum / cnt * 1000))    

        if args.output_dir and (epoch % 100 == 0 or epoch + 1 == args.epochs):
            output_dir = Path(args.output_dir)
            epoch_name = str(epoch)
            checkpoint_paths = [output_dir / ('checkpoint-%s.pth' % epoch_name)]
            for checkpoint_path in checkpoint_paths:
                to_save = {
                    'encoder': encoder.state_dict(),
                    # 'codebook': codebook.state_dict(),
                    'decoder': decoder.state_dict(),                    
                    'optimizer': optimizer.state_dict(),
                    # 'decoder_optimizer': decoder_optimizer.state_dict(),
                    # 'encoder_loss_scaler': encoder_loss_scaler.state_dict(),
                    'loss_scaler': loss_scaler.state_dict(),
                    'epoch': epoch,
                    'args': args
                }
                torch.save(to_save, checkpoint_path)

    total_time = time.time() - start_time
    total_time_str = str(datetime.timedelta(seconds=int(total_time)))
    print('Training time {}'.format(total_time_str))
    log.close()

if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    if args.output_dir:
        Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    main(args)
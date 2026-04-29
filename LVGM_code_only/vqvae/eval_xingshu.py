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
# from typing_extensions import OrderedDict
import torchvision.transforms as transforms
import torchvision.datasets as datasets

import timm
import timm.optim.optim_factory as optim_factory
from timm.data import Mixup
from timm.utils import accuracy

from typing import Iterable, Optional

from dataset_xingshu import MyDataset_stage_one
from model_8_new import Encoder_stage_one, Decoder_stage_one

from scaler import NativeScalerWithGradNormCount as NativeScaler
from utils import requires_grad, L1_loss, L2_loss
from diffvg_f import vec2raster_1img as vec2raster
import pydiffvg

def get_args_parser():
    parser = argparse.ArgumentParser('Stage one Eval')
    # parser.add_argument('--epochs', default = 600, type = int, help = 'Training rounds')
    parser.add_argument('--batch_size', default = 1, type = int, help = 'Batch size per GPU')
    parser.add_argument('--device', default = 'cuda', help = 'Device to use for training / testing')

    parser.add_argument('--canvas_size', default= 256, type=int, help= 'Canvas size of SVG')
    parser.add_argument('--fixed_length', default= 96, type=int, help = 'Padding to fixed length of drawing instructions')

    parser.add_argument('--learning_rate', default=1e-5, metavar = 'LR', help = 'Learning rate (absolute lr)')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/tt/', help = 'SVG saved dir')
    parser.add_argument('--output_dir', default='eval_vqvaetry', help='Path where to save, empty for no saving')

    parser.add_argument('--start_epoch', default = 0, type = int, help = 'Start epoch')
    parser.add_argument('--resume', default = None, metavar = 'Resume', help = 'Resume from checkpoint')

    parser.add_argument('--embedding_para', default=1, type=float, metavar = 'Hyperparameters', help = 'Hyperparameters of embedding loss')
    parser.add_argument('--commitment_para', default=0.25, type=float, metavar = 'Hyperparameters', help = 'Hyperparameters of commitment loss')

    return parser

def main(args):
    device = torch.device(args.device)
    cudnn.benchmark = True

    dataset = MyDataset_stage_one(args.svg_path, args.fixed_length)
    sampler = torch.utils.data.RandomSampler(dataset)
    data_loader_train = torch.utils.data.DataLoader(
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
        # decoder_optimizer.load_state_dict(checkpoint['decoder_optimizer'])
        # encoder_loss_scaler.load_state_dict(checkpoint['encoder_loss_scaler'])
        loss_scaler.load_state_dict(checkpoint['loss_scaler'])
        args.start_epoch = checkpoint['epoch'] + 1
        print("With optim & sched!")
    
    encoder.train(mode=False)
    decoder.train(mode=False)
    requires_grad(encoder, False)
    requires_grad(decoder, False)
    
    print(f"Start Eval")
    start_time = time.time()
    num = 0
    mse_loss = torch.nn.MSELoss()
    for sp, (strokes) in enumerate(data_loader_train):
        strokes = strokes.to(device) 
        print(strokes.shape)
        if 0:
            ## singleword in 1 img
            B, N, _, _ = strokes.shape
            strokes = strokes.reshape(B*N, 6, 12, 8) 
            stroke_encode, stroke_vq, emb_loss, _ = encoder(strokes, device)
            strokes_pred = decoder(stroke_vq)
            
            strokes = strokes.reshape(B, N, args.fixed_length, 6)
            strokes_pred = strokes_pred.reshape(B, N, args.fixed_length, 6)
            # print(strokes.shape)
            # print(strokes_pred.shape)

            outpred=vec2raster(strokes_pred[0], device, draw=True, canvas_size=1024, num=0)
            ori=vec2raster(strokes[0], device, draw=True, canvas_size=1024, num=1000)

            ori = ori.cpu()
            outpred = outpred.cpu()
            strokes = strokes.cpu()
            strokes_pred = strokes_pred.cpu()
            for i in range(len(ori)):
                img = np.concatenate([ori[i],outpred[i]], 1)
                pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(num+i)+'_1024.png')
            num += len(ori)
        elif 0:
            ori=vec2raster(strokes, device, draw=True, canvas_size=1024, num=1000)
            ori = ori.cpu()
            strokes = strokes.cpu()
            for i in range(len(ori)):
                img = ori[i]
                pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(num+i)+'_1024.png')
            num += len(ori)
        else:
            ## normal
            B, _, _ = strokes.shape
            strokes = strokes.reshape(B, 6, 12, 8) 
            stroke_encode, stroke_vq, emb_loss, _ = encoder(strokes, device)
            print(_)
            strokes_pred = decoder(stroke_vq)
            
            strokes = strokes.reshape(B, args.fixed_length, 6)
            strokes_pred = strokes_pred.reshape(B, args.fixed_length, 6)
            for i in range(len(strokes)):
                with open(args.output_dir+'/vector'+str(num+i)+'.txt', 'w') as f:
                    f.write("ori(pred):\n")
                    for j in range(len(strokes[i])):
                        for k in range(6):
                            f.write('%.4f(%.4f),' % (strokes[i][j][k].item()*2048-1024, strokes_pred[i][j][k].item()*2048-1024))
                        f.write('\n')

            outpred=vec2raster(strokes_pred, device, draw=True, canvas_size=1024, num=0)
            ori=vec2raster(strokes, device, draw=True, canvas_size=1024, num=1000)

            ori = ori.cpu()
            outpred = outpred.cpu()
            strokes = strokes.cpu()
            strokes_pred = strokes_pred.cpu()
            for i in range(len(ori)):
                img = np.concatenate([ori[i],outpred[i]], 1)
                pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(num+i)+'_1024.png')
            num += len(ori)

    total_time = time.time() - start_time
    total_time_str = str(datetime.timedelta(seconds=int(total_time)))
    print('Evaluating time {}'.format(total_time_str))
    

if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    if args.output_dir:
        Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    main(args)

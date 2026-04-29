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

from dataset import MyDataset_stage_one
from model_8_new import Encoder_stage_one, Decoder_stage_one
from scaler import NativeScalerWithGradNormCount as NativeScaler
from utils import requires_grad, L1_loss, L2_loss
from torch.utils.tensorboard import SummaryWriter

def get_args_parser():
    parser = argparse.ArgumentParser('Stage one Training')
    parser.add_argument('--epochs', default = 3000, type = int, help = 'Training rounds')
    parser.add_argument('--batch_size', default = 128, type = int, help = 'Batch size per GPU')
    parser.add_argument('--device', default = 'cuda', help = 'Device to use for training / testing')

    parser.add_argument('--canvas_size', default= 1024, type=int, help= 'Canvas size of SVG')
    parser.add_argument('--fixed_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')

    parser.add_argument('--learning_rate', default=1e-4, type=float, metavar = 'LR', help = 'Learning rate (absolute lr)')
    parser.add_argument('--svg_path', default='D:/矢量字体生成项目/data/makemeahanzi-master/makemeahanzi-master/svgs', help = 'SVG saved dir')
    parser.add_argument('--output_dir', default='output_dir', help='Path where to save, empty for no saving')

    parser.add_argument('--start_epoch', default = 0, type = int, help = 'Start epoch')
    parser.add_argument('--resume', default = None, metavar = 'Resume', help = 'Resume from checkpoint')

    parser.add_argument('--log_dir', default='log', help='log dir')
    
    # 新增：num_workers参数
    parser.add_argument('--num_workers', default=0, type=int, help='Number of data loading workers (0 for Windows)')

    return parser

def main(args):
    # 1. 首先检查CUDA是否可用
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    
    # 2. 设置设备
    device = torch.device(args.device if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # 3. 创建日志
    log = SummaryWriter(args.log_dir)
    cudnn.benchmark = True

    # 4. 创建数据集和数据加载器
    print(f"Loading dataset from: {args.svg_path}")
    dataset = MyDataset_stage_one(args.svg_path, args.fixed_length)
    print(f"Dataset size: {len(dataset)}")
    
    # 为了调试，先查看一个样本
    if len(dataset) > 0:
        sample = dataset[0]
        print(f"Sample shape: {sample.shape if hasattr(sample, 'shape') else type(sample)}")
    
    sampler = torch.utils.data.RandomSampler(dataset)
    data_loader_train = torch.utils.data.DataLoader(
        dataset = dataset,
        batch_size = args.batch_size,
        sampler = sampler,
        drop_last = True,
        num_workers = args.num_workers,  # Windows上设为0
        pin_memory = True  # 如果使用GPU，可以加速数据传输
    )

    # 5. 创建模型
    print("Creating model...")
    encoder = Encoder_stage_one()
    decoder = Decoder_stage_one()
    
    # 将模型移到设备
    encoder.to(device)
    decoder.to(device)
    
    # 打印模型参数量
    encoder_params = sum(p.numel() for p in encoder.parameters())
    decoder_params = sum(p.numel() for p in decoder.parameters())
    print(f"Encoder parameters: {encoder_params:,}")
    print(f"Decoder parameters: {decoder_params:,}")
    print(f"Total parameters: {encoder_params + decoder_params:,}")

    optimizer = torch.optim.AdamW(list(encoder.parameters())+list(decoder.parameters()), lr = args.learning_rate)
    loss_scaler = NativeScaler()

    if args.resume is not None:
        print(f"Resuming from checkpoint: {args.resume}")
        checkpoint = torch.load(args.resume, map_location='cpu')

        encoder.load_state_dict(checkpoint['encoder'])
        decoder.load_state_dict(checkpoint['decoder'])

        optimizer.load_state_dict(checkpoint['optimizer'])
        loss_scaler.load_state_dict(checkpoint['loss_scaler'])
        args.start_epoch = checkpoint['epoch'] + 1
        print("Loaded checkpoint successfully!")
    
    encoder.train(mode=True)
    decoder.train(mode=True)
    requires_grad(encoder, True)
    requires_grad(decoder, True)

    mse_loss = torch.nn.MSELoss()
    mae_loss = torch.nn.L1Loss()
    
    print(f"Start training for {args.epochs} epochs")
    print(f"Batch size: {args.batch_size}, Learning rate: {args.learning_rate}")
    print(f"Number of batches per epoch: {len(data_loader_train)}")
    
    start_time = time.time()
    
    try:
        for epoch in range(args.start_epoch, args.epochs):
            print(f'\n=== Epoch {epoch} ===')

            cnt = 0
            loss_sum = 0
            l1loss_sum = 0
            l2loss_sum = 0

            for data_iter_step, strokes in enumerate(data_loader_train):
                # 调试：打印batch信息
                if data_iter_step == 0:
                    print(f"First batch shape: {strokes.shape}")
                    print(f"Device of batch: {strokes.device}")
                
                # 确保数据在正确的设备上
                strokes = strokes.to(device)
                B, _, _ = strokes.shape
                strokes = strokes.reshape(B, 6, 8, 8)
                
                if data_iter_step == 0:
                    print(f"Reshaped batch shape: {strokes.shape}")
                
                optimizer.zero_grad()
                
                # 前向传播
                with torch.cuda.amp.autocast(enabled=(device.type == 'cuda')):
                    stroke_encode, stroke_vq, emb_loss, _ = encoder(strokes, device)
                    strokes_pred = decoder(stroke_vq)
                    
                    # 计算损失
                    rec_loss = mse_loss(strokes, strokes_pred)
                    loss = rec_loss + emb_loss
                
                # 检查损失是否为有限值
                loss_value = loss.item()
                if not math.isfinite(loss_value):
                    print(f"Warning: Loss is {loss_value}, skipping batch")
                    optimizer.zero_grad()
                    continue
                
                # 反向传播
                loss.backward()
                optimizer.step()
                
                # 统计
                cnt += 1
                loss_sum += loss_value
                
                # 每10个batch打印一次进度
                if data_iter_step % 10 == 0:
                    print(f"  Batch {data_iter_step}/{len(data_loader_train)}: loss={loss_value:.4f}")
                
                # 为了快速测试，可以先只训练几个batch
                if data_iter_step >= 5 and epoch == 0:  # 只在第一个epoch测试前5个batch
                    print("Test completed successfully!")
                    break
            
            # 打印epoch统计
            if cnt > 0:
                avg_loss = loss_sum / cnt
                print(f"Epoch {epoch} average loss: {avg_loss:.6f}")
                log.add_scalar('loss', avg_loss, epoch)
            
            # 保存checkpoint
            if args.output_dir and (epoch % 50 == 0 or epoch + 1 == args.epochs):
                output_dir = Path(args.output_dir)
                epoch_name = str(epoch)
                checkpoint_path = output_dir / f'checkpoint-{epoch_name}.pth'
                
                to_save = {
                    'encoder': encoder.state_dict(),
                    'decoder': decoder.state_dict(),
                    'optimizer': optimizer.state_dict(),
                    'loss_scaler': loss_scaler.state_dict(),
                    'epoch': epoch,
                    'args': args
                }
                
                torch.save(to_save, checkpoint_path)
                print(f"Saved checkpoint to {checkpoint_path}")
    
    except Exception as e:
        print(f"Error during training: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        total_time = time.time() - start_time
        total_time_str = str(datetime.timedelta(seconds=int(total_time)))
        print(f'Training time: {total_time_str}')
        log.close()

if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    
    # 创建输出目录
    if args.output_dir:
        Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    
    # 创建日志目录
    Path(args.log_dir).mkdir(parents=True, exist_ok=True)
    
    # 运行主函数
    main(args)
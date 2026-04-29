import argparse
import torch
import numpy as np
import os
from transformers import AutoModelForSequenceClassification, AutoTokenizer, TrainingArguments, AutoModelForCausalLM
from trl import RewardTrainer, SFTTrainer
from datasets import Dataset

# from stage1.model import Encoder_stage_one as tokenencoder
# from stage1.dataset import MyDataset_stage_one as mydataset
from vqvae.singleword import MyDataset_stage_one as mydataset
from vqvae.model_16 import Encoder_stage_one as tokenencoder
from vqvae.model_16 import Decoder_stage_one as tokendecoder
from vqvae.diffvg_f import vec2raster_1img as vec2raster
import pydiffvg

TOKENNUM = 30000
EMBEDNUM = 16
BOS_TOKEN = TOKENNUM + 1
EOS_TOKEN = TOKENNUM + 2
PAD_TOKEN = TOKENNUM + 3
SEP_TOKEN = TOKENNUM + 4

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--decoder', default = None, metavar = 'Decoder', help = 'Decoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/testtry/1', help = 'SVG saved dir')
    parser.add_argument('--fixed_draw_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')
    parser.add_argument('--fixed_stroke_length', default= 48, type=int, help = 'Padding to fixed length of one word strokes')
    parser.add_argument('--batch_size', default = 1, type = int, help = 'Batch size per GPU')
    parser.add_argument('--output_dir', default='eval_outputtry', help='Path where to save, empty for no saving')
    parser.add_argument('--canvas_size', default= 1024, type=int, help= 'Canvas size of SVG')
    
    parser.add_argument('--max_text_length', default = 550, type = int, help = 'Max length of text')
    return parser

def main(args):
    tokens = [15391, 19289, 27033, 19503, 10829, 12772, 4976, 22388, 23655, 1664, 6132, 12344, 21097, 24933, 6519, 24087, 17016, 4611, 17288, 22388, 3966, 27468, 22816, 10837, 18493, 21346, 10527, 21874, 775, 20531, 4710, 27176, 15257, 16940, 25764, 26193, 29415, 1904, 3788, 1201, 23231, 14299, 11764, 29648, 27860, 20609, 3630, 15647, 28070, 28032, 28307, 14892, 21297, 10601, 10734, 3197, 28999, 25032, 3694, 11378, 25303, 3458, 22064, 9287, 6449, 26278, 275, 18082, 15733, 25148, 8990, 3788, 24038, 7380, 26743, 21270, 24808, 1780, 25469, 6666, 20209, 8866, 8229, 20636, 3079, 21097, 29490, 9113, 6703, 6062, 7066, 17151, 8672, 6554, 18487, 14150]
    tokens = torch.tensor(tokens)

    encoder = tokenencoder()
    encoder.to(args.device)
    decoder = tokendecoder()
    decoder.to(args.device)
    checkpoint = torch.load(args.encoder, map_location='cpu')
    encoder.load_state_dict(checkpoint['encoder'])
    decoder.load_state_dict(checkpoint['decoder'])
    encoder.train(mode=False)
    decoder.train(mode=False)

    print(tokens)
    # print(tokens_pred)
    strokes = encoder.get_zq_from_id(tokens, args.device)
    # strokes_pred = encoder.get_zq_from_id(tokens_pred, args.device)
    strokes = decoder(strokes)
    # strokes_pred = decoder(strokes_pred)
    strokes = strokes.reshape(tokens.shape[0]//EMBEDNUM, 64, 6)
    # strokes_pred = strokes_pred.reshape(tokens_pred.shape[0]//EMBEDNUM, 64, 6)
    # print(strokes.shape)
    # print(strokes_pred.shape)
    # with open(os.path.join(args.output_dir, 'pred.txt'), 'w') as f:
    #     f.write(str(strokes_pred*2048-1024))

    # outpred=vec2raster(strokes_pred, args.device, draw=True, canvas_size=args.canvas_size, num=0)
    ori=vec2raster(strokes, args.device, draw=True, canvas_size=args.canvas_size, num=1000)
    # mixout=vec2raster(torch.cat([strokes, strokes_pred]), args.device, draw=True, canvas_size=args.canvas_size, num=0)

    ori = ori.cpu()
    # outpred = outpred.cpu()
    strokes = strokes.cpu()
    # strokes_pred = strokes_pred.cpu()
    # print(len(ori))
    # print(len(outpred))
    for i in range(len(ori)):
        img = ori[i].detach().numpy()
        # img = np.concatenate([ori[i].detach().numpy(),outpred[i].detach().numpy(),mixout[i].detach().cpu().numpy()], 1)
        pydiffvg.imwrite((1-img), args.output_dir+'/tokenimg'+'_'+str(args.canvas_size)+'.png')

    
if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    main(args)
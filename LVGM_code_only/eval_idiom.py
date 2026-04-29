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
# from vqvae.singleword_idiom_xingshu import MyDataset_stage_one as mydataset
from vqvae.model_8 import Encoder_stage_one as tokenencoder
from vqvae.model_8 import Decoder_stage_one as tokendecoder
from vqvae.diffvg_f import vec2raster_1img as vec2raster
import pydiffvg

TOKENNUM = 30000
EMBEDNUM = 8
BOS_TOKEN = TOKENNUM + 1
EOS_TOKEN = TOKENNUM + 2
PAD_TOKEN = TOKENNUM + 3
SEP_TOKEN = TOKENNUM + 4
ENDEMBED = [10663, 10663, 10663, 10663, 3216, 1670, 20006, 15734] # idiom 压缩到8int 空白笔画编码
# ENDEMBED = [2717, 29560, 25764, 4487, 4222, 8749, 25435, 23894] # 行书 8int 空白笔画编码

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--decoder', default = None, metavar = 'Decoder', help = 'Decoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/testtry/早/', help = 'SVG saved dir')
    parser.add_argument('--fixed_draw_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')
    parser.add_argument('--fixed_stroke_length', default= 34, type=int, help = 'Padding to fixed length of one word strokes')
    parser.add_argument('--batch_size', default = 1, type = int, help = 'Batch size per GPU')
    parser.add_argument('--output_dir', default='eval_outputtry', help='Path where to save, empty for no saving')
    parser.add_argument('--canvas_size', default= 1024, type=int, help= 'Canvas size of SVG')
    parser.add_argument('--max_stroke_sum', default= 100, type=int, help= 'Max sum of strokes for all words')
    parser.add_argument('--prompt', default=None, type = str, help='prompt characters for words generation')
    
    parser.add_argument('--max_text_length', default = 820, type = int, help = 'Max length of text')
    return parser

def postdeal(code):
    i = 0
    while i < len(code):
        if code[i:i+EMBEDNUM] == ENDEMBED:
            break
        i += EMBEDNUM
    return code[:i]

def build_dataset(args, tokenizer, encoder, max_text_len):
    """
    Create dataset
    """

    def gen(dataloader):
        for data_iter_step, (strokes) in enumerate(dataloader):
            yield {'text': strokes}

    dataset = mydataset(
        svg_path=args.svg_path, 
        fixed_stroke_length=args.fixed_stroke_length, 
        fixed_draw_length=args.fixed_draw_length, 
        canvas_size=args.canvas_size, 
        prompt=args.prompt,
        is_pad=False
    )
    # dataset = mydataset(args.svg_path, args.fixed_draw_length, True)
    sampler = torch.utils.data.RandomSampler(dataset)
    data_loader_train = torch.utils.data.DataLoader(
        dataset = dataset,
        batch_size = args.batch_size,
        sampler = sampler,
        drop_last = True
    )
    print(len(data_loader_train))
    train_ds = Dataset.from_generator(gen, gen_kwargs={'dataloader': data_loader_train})
    print('---------------------------------------------')
    for sp, (td) in enumerate(data_loader_train):
        # print(td[0]*2048-1024)
        print(td.shape)
        with open(os.path.join(args.output_dir, 'origin.txt'), 'w') as f:
            f.write(str(td[0]*2048-1024))
        ori=vec2raster(td[0], args.device, draw=True, canvas_size=args.canvas_size, num=1000)
        img = ori.detach().cpu().numpy()
        pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(sp)+'.png')
    # print(len(train_ds))
    
    def tokenize(sample):
        # SFT->prompt是正确的，只预测response loss只算response（mask在loss的时候用）
        # batchsize * {[BOS] prompt [SEP] response [EOS]}
        # print(tokenizer.convert_tokens_to_ids(tokenizer.bos_token))
        # print(sample['text'])
        _, zq, _, code =  encoder(torch.Tensor(sample['text']).to(args.device).reshape(-1, 6, 8, 8), args.device)
        code = code.reshape(-1).tolist()
        code = postdeal(list(map(int, code)))
        # print(code)
        # sample["input_ids"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] \
        #                     + code + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)] #\
                            # + [tokenizer.convert_tokens_to_ids(tokenizer.pad_token)] * (args.max_text_len - len(code) - 2)
        # sample["input_ids"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] + encode(sample['prompt'])[1:] + [tokenizer.convert_tokens_to_ids(tokenizer.sep_token)] + encode(sample['response'])[1:] + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)]
        #sample["masks"] = [0] * (max_prompt_len) + [1] * (len(tokenizer.encode(sample['response'])[1:]) + 1) + [0] * (max_response_len - len(tokenizer.encode(sample['response'])[1:]))
        # sample["attention_mask"] = [(lambda x: 0 if x == tokenizer.convert_tokens_to_ids(tokenizer.pad_token) else 1)(y) for y in sample["input_ids"]]
        # sample["own_label"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] + code + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)]
        # sample["own_label"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] + encode(sample['prompt'])[1:] + [tokenizer.convert_tokens_to_ids(tokenizer.sep_token)] + encode(sample['response'])[1:] + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)]
        # print(sample)
        sample["input_ids"] = [BOS_TOKEN] \
                            + code #+ [EOS_TOKEN] #\
                            # + [PAD_TOKEN] * (args.max_text_length - len(code) - 2)
        sample["attention_mask"] = [(lambda x: 0 if x == PAD_TOKEN else 1)(y) for y in sample["input_ids"]]
        return sample

    train_ds = train_ds.map(tokenize, batched=False)
    # val_ds = val_ds.map(tokenize, batched=False)
    # print(len(train_ds))
    train_ds.set_format(type="torch")
    # val_ds.set_format(type="torch")
    return train_ds

def main(args):
    if not args.resume:
        print("Missing resume checkpoint path")
        exit(0)
    model = AutoModelForCausalLM.from_pretrained(args.resume)
    tokenizer = AutoTokenizer.from_pretrained("./deepseek-coder-1.3b-base")
    # tokenizer.add_special_tokens({'pad_token': '[PAD]'})
    # model.resize_token_embeddings(len(tokenizer)) 
    model.resize_token_embeddings(TOKENNUM + 5)

    encoder = tokenencoder()
    encoder.to(args.device)
    decoder = tokendecoder()
    decoder.to(args.device)
    checkpoint = torch.load(args.encoder, map_location='cpu')
    encoder.load_state_dict(checkpoint['encoder'])
    decoder.load_state_dict(checkpoint['decoder'])
    encoder.train(mode=False)
    decoder.train(mode=False)

    dataset = build_dataset(args, tokenizer, encoder, args.max_text_length)
    print(len(dataset))

    for sp, data in enumerate(dataset):
        needs = ['input_ids', 'attention_mask']
        data = {k: data[k].unsqueeze(0) for k in needs}
        # print('inputs')
        print(data)
        # inputs = tokenizer(data, return_tensors="pt").to(model.device)
        outputs = model.generate(**data, max_length=args.max_text_length, do_sample=True, temperature=0.9, top_p=0.9)
        # outputs = tokenizer.decode(outputs[0], skip_special_tokens=True)
        outputs = outputs.squeeze(0)
        print(outputs)
        words = []
        lst = 1
        for i in range(1, len(outputs)):
            if outputs[i] == EOS_TOKEN or outputs[i] == SEP_TOKEN:
                print(i)
                words.append(outputs[lst:i].to(args.device))
                lst = i+1
                if outputs[i] == EOS_TOKEN:
                    break
        with open('tokens.txt', 'w') as f:
            f.write(str(words))
        print(words)
        img = None
        for tokens in words: # tokens里面是一个字的全部笔画token stack在一起
            if tokens.shape[0] % 8:
                tokens = tokens[0:tokens.shape[0]//8*8]
            strokes = encoder.get_zq_from_id(tokens, args.device)
            strokes = decoder(strokes)
            strokes = strokes.reshape(tokens.shape[0]//EMBEDNUM, 64, 6)
            # print(strokes.shape)
            with open(os.path.join(args.output_dir, 'pred.txt'), 'a') as f:
                f.write(str(strokes*2048-1024))
                f.write('\n')

            ori=vec2raster(strokes, args.device, draw=True, canvas_size=args.canvas_size, num=1000)

            ori = ori.cpu()
            print(len(ori))
            for i in range(len(ori)):
                if img is not None:
                    img = np.concatenate([img, ori[i].detach().numpy()], 1)
                else:
                    img = ori[i].detach().numpy()
            
        pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(sp)+'_'+str(args.canvas_size)+'.png')
        break

    
if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    main(args)
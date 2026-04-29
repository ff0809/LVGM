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
from vqvae.model_8_new import Encoder_stage_one as tokenencoder
from vqvae.model_8_new import Decoder_stage_one as tokendecoder
from vqvae.diffvg_f import vec2raster_1img as vec2raster
import pydiffvg

TOKENNUM = 30000
EMBEDNUM = 8
BOS_TOKEN = TOKENNUM + 1
EOS_TOKEN = TOKENNUM + 2
PAD_TOKEN = TOKENNUM + 3
SEP_TOKEN = TOKENNUM + 4
# ENDEMBED = [10663, 10663, 10663, 10663, 3216, 1670, 20006, 15734] # idiom 压缩到8int 空白笔画编码
ENDEMBED = [19444, 19444, 19444, 19444, 19229, 29852, 2443, 18889]

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--decoder', default = None, metavar = 'Decoder', help = 'Decoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/testtry/云', help = 'SVG saved dir')# 流水落花春去也，天上人间
    parser.add_argument('--fixed_draw_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')
    parser.add_argument('--fixed_stroke_length', default= 34, type=int, help = 'Padding to fixed length of one word strokes')
    parser.add_argument('--batch_size', default = 1, type = int, help = 'Batch size per GPU')
    parser.add_argument('--output_dir', default='eval_outputtry/single', help='Path where to save, empty for no saving')
    parser.add_argument('--canvas_size', default= 4096, type=int, help= 'Canvas size of SVG')
    
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

    dataset = mydataset(args.svg_path, args.fixed_stroke_length, args.fixed_draw_length, args.canvas_size, True, False)
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
    # for sp, (td) in enumerate(data_loader_train):
    #     # print(td[0]*2048-1024)
    #     print(td.shape)
    #     with open(os.path.join(args.output_dir, 'origin.txt'), 'w') as f:
    #         f.write(str(td[0]*2048-1024))
    #     ori=vec2raster(td[0], args.device, draw=True, canvas_size=args.canvas_size, num=1000)
    #     img = ori.detach().cpu().numpy()
    #     pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(sp)+'.png')
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
        # print(data)
        tokens = data['input_ids'][0][1:]
        # inputs = tokenizer(data, return_tensors="pt").to(model.device)
        outputs = model.generate(**data, max_length=args.max_text_length)
        # outputs = tokenizer.decode(outputs[0], skip_special_tokens=True)
        outputs = outputs.squeeze(0)
        # print(outputs)
        tokens_pred = None
        tokens = outputs[1:tokens.shape[0]+1]
        for i in range(1, len(outputs)):
            if outputs[i] == EOS_TOKEN or outputs[i] == SEP_TOKEN:
                # tokens = outputs[1:i-EMBEDNUM].to(args.device)
                tokens_pred = outputs[len(tokens)+1:i].to(args.device)
                break #单字生成因此break
        # with open('tokens.txt', 'w') as f:
        #     f.write(str(tokens))
        #     f.write('\n')
        #     f.write(str(tokens_pred))
        # print(tokens)
        # print(tokens_pred)
        try:
            strokes = encoder.get_zq_from_id(tokens, args.device)
            strokes = decoder(strokes)
            strokes = strokes.reshape(tokens.shape[0]//EMBEDNUM, 64, 6)
            if tokens_pred.shape[0]:
                strokes_pred = encoder.get_zq_from_id(tokens_pred, args.device)
                strokes_pred = decoder(strokes_pred)
                strokes_pred = strokes_pred.reshape(tokens_pred.shape[0]//EMBEDNUM, 64, 6)
            print(strokes.shape)
            print(strokes_pred.shape)
            # with open(os.path.join(args.output_dir, 'pred.txt'), 'w') as f:
            #     f.write(str(strokes*2048-1024))
            #     if tokens_pred.shape[0]:
            #         f.write(str(strokes_pred*2048-1024))
            
            ori=vec2raster(strokes, args.device, draw=True, canvas_size=args.canvas_size, num=1000)
            if tokens_pred.shape[0]:
                outpred=vec2raster(strokes_pred, args.device, draw=True, canvas_size=args.canvas_size, num=0)
                mixout=vec2raster(torch.cat([strokes, strokes_pred]), args.device, draw=True, canvas_size=args.canvas_size, num=0)

            ori = ori.cpu()
            strokes = strokes.cpu()
            if tokens_pred.shape[0]:
                outpred = outpred.cpu()
                strokes_pred = strokes_pred.cpu()
            # print(len(ori))
            # print(len(outpred))
            for i in range(len(ori)):
                img = ori[i].detach().numpy()
                if tokens_pred.shape[0]:
                    img = np.concatenate([ori[i].detach().numpy(),outpred[i].detach().numpy(),mixout[i].detach().cpu().numpy()], 1)
                else:
                    img = np.concatenate([ori[i].detach().numpy()], 1)
                pydiffvg.imwrite(img, args.output_dir+'/img'+str(sp+i)+'_'+str(args.canvas_size)+'.png')
        except RuntimeError:
            print("error")
            continue
            
        # break

    
if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    main(args)
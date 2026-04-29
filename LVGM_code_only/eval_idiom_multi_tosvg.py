import argparse
import torch
import numpy as np
import os
from transformers import AutoModelForSequenceClassification, AutoTokenizer, TrainingArguments, AutoModelForCausalLM
from trl import RewardTrainer, SFTTrainer
from datasets import Dataset

# from stage1.model import Encoder_stage_one as tokenencoder
# from stage1.dataset import MyDataset_stage_one as mydataset
from vqvae.singleword_idiom import MyDataset_stage_one as mydataset
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
# ENDEMBED = [2717, 29560, 25764, 4487, 4222, 8749, 25435, 23894] # 行书 8int 空白笔画编码
ENDEMBED = [19444, 19444, 19444, 19444, 19229, 29852, 2443, 18889]

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--decoder', default = None, metavar = 'Decoder', help = 'Decoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/svg/svgs', help = 'SVG saved dir')
    parser.add_argument('--fixed_draw_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')
    parser.add_argument('--fixed_stroke_length', default= 34, type=int, help = 'Padding to fixed length of one word strokes')
    parser.add_argument('--batch_size', default = 1, type = int, help = 'Batch size per GPU')
    parser.add_argument('--output_dir', default='eval_outputtry/origin', help='Path where to save, empty for no saving')
    parser.add_argument('--canvas_size', default= 1024, type=int, help= 'Canvas size of SVG')
    parser.add_argument('--max_stroke_sum', default= 100, type=int, help= 'Max sum of strokes for all words')
    parser.add_argument('--prompt', default="寒霜霁雪", type = str, help='prompt characters for words generation')
    # 欲尽金钟数斗余 欲言又止 暮景江亭上 暮鼓晨钟 独钓春江上 独当一面
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
        is_pad=True
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
        # ori=vec2raster(td[0], args.device, draw=True, canvas_size=args.canvas_size, num=1000)
        # img = ori.detach().cpu().numpy()
        # pydiffvg.imwrite((1-img), args.output_dir+'/img'+str(sp)+'.png')
    # print(len(train_ds))
    
    def tokenize(sample):
        # SFT->prompt是正确的，只预测response loss只算response（mask在loss的时候用）
        # batchsize * {[BOS] prompt [SEP] response [EOS]}
        # print(tokenizer.convert_tokens_to_ids(tokenizer.bos_token))
        # print(sample['text'])
        code = []
        for dt in sample['text'][0]:
            if code != []:
                code.append(SEP_TOKEN)

            _, _, _, cd =  encoder(torch.Tensor(dt).to(args.device).reshape(-1, 6, 8, 8), args.device)
            # print(code.shape) 4*batch_size
            # print(cd.shape) # 272
            cd = cd.reshape(-1).tolist()
            # print(cd)
            cd = postdeal(list(map(int, cd))) # 去掉空笔画对应的token， 未知总数，尝试4个字
            # cd = list(map(int, cd)) # 三个字 8*34*3=816个token
            code.extend(cd)
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
                            + code + [EOS_TOKEN] #\
                            # + [PAD_TOKEN] * (args.max_text_length - len(code) - 2)
        sample["attention_mask"] = [(lambda x: 0 if x == PAD_TOKEN else 1)(y) for y in sample["input_ids"]]
        return sample

    train_ds = train_ds.map(tokenize, batched=False)
    # val_ds = val_ds.map(tokenize, batched=False)
    # print(len(train_ds))
    train_ds.set_format(type="torch")
    # val_ds.set_format(type="torch")
    return train_ds

def remove_close_to_value(tensor, target=0.5000, tolerance=0.15):
    # Find the last index along the 64 dimension where values are outside the tolerance range
    mask = torch.abs(tensor - target) > tolerance
    valid_indices = torch.where(mask.any(dim=1))[0]
    
    if len(valid_indices) == 0:
        return tensor.new_empty((0, tensor.shape[1]))  # Return an empty tensor if no valid indices
    
    last_valid_index = valid_indices[-1].item()
    
    # Slice the tensor to remove trailing values within the tolerance range
    result = tensor[:last_valid_index + 1, :]
    return result

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
        # inputs = tokenizer(data, return_tensors="pt").to(model.device)
        outputs = model.generate(**data, max_length=args.max_text_length, do_sample=True, temperature=0.9, top_p=0.9)
        # outputs = tokenizer.decode(outputs[0], skip_special_tokens=True)
        outputs = outputs.squeeze(0)
        print(outputs)
        words = []
        lst = 1
        for i in range(1, len(outputs)):
            if outputs[i] == EOS_TOKEN or outputs[i] == SEP_TOKEN:
                # print(i)
                words.append(outputs[lst:i].to(args.device))
                lst = i+1
                if outputs[i] == EOS_TOKEN:
                    break
        # with open('tokens.txt', 'w') as f:
        #     f.write(str(words))
        # print(words)
        img = None
        wd_cnt = 0
        for tokens in words: # tokens里面是一个字的全部笔画token stack在一起
            if tokens.shape[0] % 8:
                tokens = tokens[0:tokens.shape[0]//8*8]
            strokes = encoder.get_zq_from_id(tokens, args.device)
            strokes = decoder(strokes)
            strokes = strokes.reshape(tokens.shape[0]//EMBEDNUM, 64, 6)
            # print(strokes.shape)
            with open(os.path.join(args.output_dir, 'pred'+str(wd_cnt)+'.svg'), 'w') as f:
                all = strokes
                svg = '''<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">\n'''
                for st in all:
                    print(st.shape)
                    st = remove_close_to_value(st)*2048-1024
                    print(st.shape)
                    st = st[:torch.nonzero(st)[-1][0] + 1]  # 去除无效的零点
                    print(st.shape)
                    x0, y0 = st[0][0], st[0][1]
                    path_commands = [f"M {x0},{y0}"]
                    for row in st:
                        x1, y1, x2, y2, x, y = row
                        path_commands.append(f"C {x1} {y1} {x2} {y2} {x} {y}")
                    path_data = " ".join(path_commands)

                    svg += f'''<path d="{path_data}" fill="none" stroke="black" stroke-width="5"/>\n'''
                svg += "</svg>"
                f.write(svg)

            wd_cnt += 1

        #     ori=vec2raster(strokes, args.device, draw=True, canvas_size=args.canvas_size, num=1000)

        #     ori = ori.cpu()
        #     # print(len(ori))
        #     for i in range(len(ori)):
        #         if img is not None:
        #             img = np.concatenate([img, ori[i].detach().numpy()], 1)
        #         else:
        #             img = ori[i].detach().numpy()
            
        # pydiffvg.imwrite(img, args.output_dir+'/img'+str(sp)+'_'+str(args.canvas_size)+'.png')
        break

    
if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    main(args)
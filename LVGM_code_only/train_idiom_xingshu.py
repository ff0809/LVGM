import argparse
import torch
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer, TrainingArguments, AutoModelForCausalLM
from trl import RewardTrainer, SFTTrainer
from datasets import Dataset

# from stage1.model import Encoder_stage_one as tokenencoder
# from stage1.dataset import MyDataset_stage_one as mydataset
# from vqvae.dataset import MyDataset_stage_one as mydataset
from vqvae.singleword_idiom_xingshu import MyDataset_stage_one as mydataset
from vqvae.model_8_new import Encoder_stage_one as tokenencoder

TOKENNUM = 30000
EMBEDNUM = 12
BOS_TOKEN = TOKENNUM + 1
EOS_TOKEN = TOKENNUM + 2
PAD_TOKEN = TOKENNUM + 3
SEP_TOKEN = TOKENNUM + 4
# ENDEMBED = [29713, 16111, 7692, 29713, 15279, 27759, 19824, 15843, 19108, 24068, 29137, 25424, 4939, 1155, 20198, 18609] # 单字16
# ENDEMBED = [10663, 10663, 10663, 10663, 3216, 1670, 20006, 15734] # idiom 压缩到8int 空白笔画编码
# ENDEMBED = [29603, 22203, 19864, 26328, 6674, 1400, 14554, 9419] # 行书 8int 空白笔画编码
ENDEMBED = [4042, 23614, 23614, 23614, 26404, 2865, 16472, 25168, 10916, 23073, 22161, 26900] # 行书 12int 空白笔画编码
# ENDEMBED = [7134, 18195, 12907, 5428]
# ENDEMBED = [19444, 19444, 19444, 19444, 19229, 29852, 2443, 18889] # 21000最终

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/xingshu', help = 'SVG saved dir')
    parser.add_argument('--idiom_path', default='/home/tongji209/latest/codeanddata/idiom.json', help = 'idiom saved dir')
    parser.add_argument('--ci_path', default='/home/tongji209/latest/codeanddata/ci.json', help = 'ci saved dir')
    parser.add_argument('--shi_path', default='/home/tongji209/latest/codeanddata/shi.json', help = 'shi saved dir')
    parser.add_argument('--fixed_draw_length', default = 96, type=int, help = 'Padding to fixed length of one stroke drawing instructions')# 一个笔画固定绘画命令数
    parser.add_argument('--fixed_stroke_length', default = 24, type=int, help = 'Padding to fixed length of one word strokes')# 一个字固定笔画数 楷书33 行书23
    parser.add_argument('--batch_size', default = 1, type = int, help = 'num of strokes for one tokenize') # 4个字
    
    parser.add_argument('--max_text_length', default = 820, type = int, help = 'Max length of text') # kaishu820 xingshu90*8=720
    parser.add_argument('--max_stroke_sum', default = 65, type = int, help = 'Max sum of strokes')
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

    dataset = mydataset(args.svg_path, args.idiom_path, args.ci_path, args.shi_path, args.max_stroke_sum)
    exit(0)
    sampler = torch.utils.data.RandomSampler(dataset)
    data_loader_train = torch.utils.data.DataLoader(
        dataset = dataset,
        batch_size = args.batch_size,
        sampler = sampler,
        drop_last = True
    )
    train_ds = Dataset.from_generator(gen, gen_kwargs={'dataloader': data_loader_train})
    print(len(train_ds))
    
    def tokenize(sample):
        # SFT->prompt是正确的，只预测response loss只算response（mask在loss的时候用）
        # batchsize * {[BOS] token word [SEP] token next word [EOS]}
        # print(tokenizer.convert_tokens_to_ids(tokenizer.bos_token))
        # print(sample['text'])

        code = []
        for dt in sample['text'][0]:
            if code != []:
                code.append(SEP_TOKEN)
                
            _, _, _, cd =  encoder(torch.Tensor(dt).to(args.device).reshape(-1, 6, 12, 8), args.device)
            
            # print(cd)
            # exit(0)
            # print(code.shape) 4*batch_size
            # print(cd.shape) # 272
            cd = cd.reshape(-1).tolist()
            # print(cd)
            cd = postdeal(list(map(int, cd))) # 去掉空笔画对应的token， 未知总数，尝试4个字
            # print(cd)
            # print(len(cd))
            # cd = list(map(int, cd)) # 三个字 8*34*3=816个token
            code.extend(cd)
        # print(code)
        # exit(0)
        # sample["input_ids"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] \
        #                     + code + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)] \
        #                     + [tokenizer.convert_tokens_to_ids(tokenizer.pad_token)] * (args.max_text_length - len(code) - 2)
        # sample["attention_mask"] = [(lambda x: 0 if x == tokenizer.convert_tokens_to_ids(tokenizer.pad_token) else 1)(y) for y in sample["input_ids"]]
        # sample["labels"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] \
        #                     + code + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)] \
        #                     + [tokenizer.convert_tokens_to_ids(tokenizer.pad_token)] * (args.max_text_length - len(code) - 2)
        sample["input_ids"] = [BOS_TOKEN] + code + [EOS_TOKEN] + [PAD_TOKEN] * (args.max_text_length - len(code) - 2)
        sample["attention_mask"] = [(lambda x: 0 if x == PAD_TOKEN else 1)(y) for y in sample["input_ids"]]
        sample["labels"] = code + [EOS_TOKEN] + [PAD_TOKEN] * (args.max_text_length - len(code) - 1)
        # with open('bbb.txt', 'a') as f:
        #     i = 1
        #     while i < len(sample['input_ids']):
        #         if sample['input_ids'][i] == SEP_TOKEN:
        #             f.write(str(sample['input_ids'][i:i+1]))
        #             f.write('\n')
        #             i += 1
        #         f.write(str(sample['input_ids'][i:min(i+EMBEDNUM, len(sample['input_ids']))]))
        #         f.write('\n')
        #         i += EMBEDNUM
        #     f.write('end here')
        # print(sample["input_ids"])
        return sample

    train_ds = train_ds.map(tokenize, batched=False)
    # val_ds = val_ds.map(tokenize, batched=False)
    print(len(train_ds))
    train_ds.set_format(type="torch")
    # val_ds.set_format(type="torch")
    return train_ds

def main(args):
    model = AutoModelForCausalLM.from_pretrained(args.resume)
    tokenizer = AutoTokenizer.from_pretrained("./deepseek-coder-1.3b-base")
    # tokenizer.add_special_tokens({'pad_token': '[PAD]'})
    # model.resize_token_embeddings(len(tokenizer)) 
    model.resize_token_embeddings(TOKENNUM + 5)

    encoder = tokenencoder()
    encoder.to(args.device)
    checkpoint = torch.load(args.encoder, map_location='cpu')
    encoder.load_state_dict(checkpoint['encoder'])
    encoder.train(mode=False)

    dataset = build_dataset(args, tokenizer, encoder, args.max_text_length)
    print('dataset done')

    trargs = TrainingArguments(
        output_dir='output',
        per_device_train_batch_size=4,# 1->25657MB/32768MB 2->30239MB/32768MB
        report_to="tensorboard",
        num_train_epochs=10,
        # logging_steps=3,
        save_steps=20000,
        label_smoothing_factor=0.001,
    )

    trainer = SFTTrainer(
        model=model,
        # tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=args.max_text_length,
        args=trargs
    )
    trainer.train()
    
if __name__ == '__main__':
    args = get_args_parser()
    args = args.parse_args()
    main(args)
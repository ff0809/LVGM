import argparse
import torch
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer, TrainingArguments, AutoModelForCausalLM
from trl import RewardTrainer, SFTTrainer
from datasets import Dataset

# from stage1.model import Encoder_stage_one as tokenencoder
# from stage1.dataset import MyDataset_stage_one as mydataset
# from vqvae.dataset import MyDataset_stage_one as mydataset
from vqvae.singleword import MyDataset_stage_one as mydataset
from vqvae.model_8_new import Encoder_stage_one as tokenencoder

TOKENNUM = 30000
EMBEDNUM = 8
BOS_TOKEN = TOKENNUM + 1
EOS_TOKEN = TOKENNUM + 2
PAD_TOKEN = TOKENNUM + 3
SEP_TOKEN = TOKENNUM + 4
ENDEMBED = [29713, 16111, 7692, 29713, 15279, 27759, 19824, 15843, 19108, 24068, 29137, 25424, 4939, 1155, 20198, 18609]

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/testtry/1', help = 'SVG saved dir')
    parser.add_argument('--fixed_draw_length', default = 64, type=int, help = 'Padding to fixed length of one stroke drawing instructions')# 一个笔画固定绘画命令数
    parser.add_argument('--fixed_stroke_length', default = 34, type=int, help = 'Padding to fixed length of one word strokes')# 一个字固定笔画数
    parser.add_argument('--batch_size', default = 1, type = int, help = 'num of strokes for one tokenize') # 1个字
    
    parser.add_argument('--max_text_length', default = 550, type = int, help = 'Max length of text')
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

    dataset = mydataset(args.svg_path)
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
        # batchsize * {[BOS] prompt [SEP] response [EOS]}
        # print(tokenizer.convert_tokens_to_ids(tokenizer.bos_token))
        # print(sample['text'])
        _, _, _, code =  encoder(torch.Tensor(sample['text']).to(args.device).reshape(-1, 6, 8, 8), args.device)
        print(code)
        # print(code.shape) 4*batch_size
        code = code.reshape(-1).tolist()
        code = postdeal(list(map(int, code)))
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
    model.resize_token_embeddings(TOKENNUM + 4)

    encoder = tokenencoder()
    encoder.to(args.device)
    checkpoint = torch.load(args.encoder, map_location='cpu')
    encoder.load_state_dict(checkpoint['encoder'])
    encoder.train(mode=False)

    dataset = build_dataset(args, tokenizer, encoder, args.max_text_length)

    trargs = TrainingArguments(
        output_dir='output',
        per_device_train_batch_size=4,# 1->25657MB/32768MB 2->30239MB/32768MB
        report_to="tensorboard",
        num_train_epochs=10,
        save_steps=2500,
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
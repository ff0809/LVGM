import argparse
import torch
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer, TrainingArguments, AutoModelForCausalLM
from trl import RewardTrainer, SFTTrainer
from datasets import Dataset

# from stage1.model import Encoder_stage_one as tokenencoder
# from stage1.dataset import MyDataset_stage_one as mydataset
from vqvae.dataset import MyDataset_stage_one as mydataset
# from vqvae.singleword import MyDataset_stage_one as mydataset
from vqvae.model import Encoder_stage_one as tokenencoder

BOS_TOKEN = 8192
EOS_TOKEN = 8193
PAD_TOKEN = 8194
SEP_TOKEN = 8195 #

def get_args_parser():
    parser = argparse.ArgumentParser('Stage two Training')
    parser.add_argument('--encoder', default = None, metavar = 'Encoder', help = 'Encoder for datasets')
    parser.add_argument('--resume', default = './deepseek-coder-1.3b-base', metavar = 'Resume', help = 'Resume from checkpoint')
    parser.add_argument('--device', default = 'cuda:0', help = 'Device to use for training / testing')
    parser.add_argument('--svg_path', default='/home/tongji209/latest/codeanddata/svg/svgs', help = 'SVG saved dir')
    parser.add_argument('--fixed_draw_length', default= 64, type=int, help = 'Padding to fixed length of drawing instructions')
    parser.add_argument('--fixed_stroke_length', default= 48, type=int, help = 'Padding to fixed length of one word strokes')
    # parser.add_argument('--batch_size', default = 120, type = int, help = 'num of strokes for one tokenize')
    # 2 words
    parser.add_argument('--max_text_length', default = 400, type = int, help = 'Max length of text') # 小一点 48*4=192
    return parser

def build_dataset(args, tokenizer, encoder, max_text_len):
    """
    Create dataset
    """

    def gen(dataloader):
        for data_iter_step, (strokes) in enumerate(dataloader):
            yield {'text': strokes}

    # dataset = mydataset(args.svg_path, args.fixed_stroke_length, args.fixed_draw_length, True)
    dataset = mydataset(args.svg_path, args.fixed_draw_length)
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
        _, _, _, code =  encoder(torch.Tensor(sample['text']).to(args.device).reshape(-1, 6, 8, 8), args.device)
        # print(code.shape) 4*batch_size
        code = code.reshape(-1).tolist()
        code = list(map(int, code))
        # sample["input_ids"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] \
        #                     + code + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)] \
        #                     + [tokenizer.convert_tokens_to_ids(tokenizer.pad_token)] * (args.max_text_length - len(code) - 2)
        # sample["attention_mask"] = [(lambda x: 0 if x == tokenizer.convert_tokens_to_ids(tokenizer.pad_token) else 1)(y) for y in sample["input_ids"]]
        # sample["labels"] = [tokenizer.convert_tokens_to_ids(tokenizer.bos_token)] \
        #                     + code + [tokenizer.convert_tokens_to_ids(tokenizer.eos_token)] \
        #                     + [tokenizer.convert_tokens_to_ids(tokenizer.pad_token)] * (args.max_text_length - len(code) - 2)
        sample["input_ids"] = [BOS_TOKEN] + code + [EOS_TOKEN] \
                                + [PAD_TOKEN] * (args.max_text_length - len(code) - 2)
        sample["attention_mask"] = [(lambda x: 0 if x == PAD_TOKEN else 1)(y) for y in sample["input_ids"]]
        sample["labels"] = code + [EOS_TOKEN] \
                            + [PAD_TOKEN] * (args.max_text_length - len(code) - 1)
        # print(sample)
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
    model.resize_token_embeddings(8195)

    encoder = tokenencoder()
    encoder.to(args.device)
    checkpoint = torch.load(args.encoder, map_location='cpu')
    encoder.load_state_dict(checkpoint['encoder'])
    encoder.train(mode=False)

    dataset = build_dataset(args, tokenizer, encoder, args.max_text_length)

    trargs = TrainingArguments(
        output_dir='output',
        per_device_train_batch_size=8,# 1->25657MB/32768MB 2->30239MB/32768MB 大一点
        report_to="tensorboard",
        num_train_epochs=500,
        save_steps=1000,
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
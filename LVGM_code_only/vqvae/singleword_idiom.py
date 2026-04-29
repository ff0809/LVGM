import numpy as np
from PIL import Image
import xml.etree.ElementTree as ET
import os
import sys

import torch
import torch.utils.data
import torchvision.transforms as transforms
import tqdm, random, json, re

def is_hex_number(str_input):
    str_input = str_input.upper()
    if re.match(r'^[0-9A-F]+$', str_input[2:]):
        return True  # 字符串是16进制数字
    else:
        return False  # 字符串不是16进制数字

class MyDataset_stage_one(torch.utils.data.Dataset):
    def __init__(self, svg_path, idiom_path=None, ci_path=None, shi_path=None, max_stroke_sum=100, 
        fixed_stroke_length=34, fixed_draw_length=64, canvas_size=1024, prompt=None, is_normalization=True, is_pad=True, transform = None):
        super().__init__()
        word_list = {}
        word_stroke_len = {}
        self.svg_path = svg_path
        self.fixed_draw_length = fixed_draw_length
        self.fixed_stroke_length = fixed_stroke_length
        self.canvas_size = canvas_size
        self.is_normalization = is_normalization
        self.empty_token = [0., 0., 0., 0., 0., 0.]
        self.is_pad = is_pad

        for file in os.listdir(svg_path):
            tree = ET.parse(os.path.join(svg_path, file))
            root = tree.getroot()

            storke_list = []
            cnt = 0
            for g in root.findall('{http://www.w3.org/2000/svg}g'):
                if g.attrib.get('transform'):
                    for clip_path in g.findall('{http://www.w3.org/2000/svg}clipPath'):
                        stroke = clip_path.find('{http://www.w3.org/2000/svg}path').attrib['d'].split(' ')
                        proprecessed_stroke = []
                        beginx = beginy = 0.
                        for i in range(len(stroke)):
                            if stroke[i] == "M":
                                sx = float(stroke[i + 1])
                                sy = float(stroke[i + 2]) * -1. + 900.
                            elif stroke[i] == "C":
                                cx1 = float(stroke[i + 1])
                                cy1 = float(stroke[i + 2]) * -1. + 900.
                                cx2 = float(stroke[i + 3])
                                cy2 = float(stroke[i + 4]) * -1. + 900.
                                ex = float(stroke[i + 5])
                                ey = float(stroke[i + 6]) * -1. + 900.
                                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                                sx = ex
                                sy = ey
                            elif stroke[i] == "Q":
                                cx = float(stroke[i + 1])
                                cy = float(stroke[i + 2]) * -1. + 900.
                                ex = float(stroke[i + 3])
                                ey = float(stroke[i + 4]) * -1. + 900.
                                cx1 = sx + 2. / 3. * (cx - sx)
                                cy1 = sy + 2. / 3. * (cy - sy)
                                cx2 = ex + 2. / 3. * (cx - ex)
                                cy2 = ey + 2. / 3. * (cy - ey)
                                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                                sx = ex
                                sy = ey
                            elif stroke[i] == "L":
                                ex = float(stroke[i + 1])
                                ey = float(stroke[i + 2]) * -1. + 900.
                                cx = ex
                                cy = ey
                                cx1 = sx + 2. / 3. * (cx - sx)
                                cy1 = sy + 2. / 3. * (cy - sy)
                                cx2 = ex + 2. / 3. * (cx - ex)
                                cy2 = ey + 2. / 3. * (cy - ey)
                                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                                sx = ex
                                sy = ey
                            elif stroke[i] == "Z":
                                ex = sx
                                ey = sy
                                cx = ex
                                cy = ey
                                cx1 = sx + 2. / 3. * (cx - sx)
                                cy1 = sy + 2. / 3. * (cy - sy)
                                cx2 = ex + 2. / 3. * (cx - ex)
                                cy2 = ey + 2. / 3. * (cy - ey)
                                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                                sx = ex
                                sy = ey
                            elif stroke[i] == "H" or stroke[i] == "V" or stroke[i] == "S" or stroke[i] == "T" or stroke[i] == "A":
                                print("----------------???--------------")
                        if len(proprecessed_stroke) < self.fixed_draw_length: # 单个笔画的命令填充到64
                            extension_count = self.fixed_draw_length - len(proprecessed_stroke)
                            extension_elements = [self.empty_token] * extension_count
                            proprecessed_stroke.extend(extension_elements)
                        if len(proprecessed_stroke) != self.fixed_draw_length:
                            print('draw length error {}'.format(len(proprecessed_stroke)))
                            print(self.fixed_draw_length)
                            print(proprecessed_stroke)
                        # aaaa = np.array(proprecessed_stroke)
                        # print(aaaa.shape)
                        storke_list.append(proprecessed_stroke)
            cnt += len(storke_list) # 累计有效笔画数
            if self.is_pad and len(storke_list) < self.fixed_stroke_length: # 单个字的笔画数填充到34
                extension_count = self.fixed_stroke_length - len(storke_list)
                extension_elements = [[self.empty_token] * self.fixed_draw_length] * extension_count
                storke_list.extend(extension_elements)
            if self.is_pad and len(storke_list) != self.fixed_stroke_length:
                print('stroke length error {}'.format(len(storke_list)))
            word_list[file.split('.')[0]] = storke_list
            word_stroke_len[file.split('.')[0]] = cnt
        
        print('Read {} words'.format(len(word_list)))

        if idiom_path is not None:
            idiom_data = None
            with open(idiom_path, 'r') as f:
                idiom_data = json.load(f)
            print('json loads {}'.format(len(idiom_data)))

            self.word_list = []
            # idiom_data = random.sample(idiom_data, 5)
            # idiom_data = random.sample(idiom_data, 15000)
            for dt in idiom_data:
                wd = dt['word']
                ret = wd.encode('unicode_escape').decode().split('\\u')
                wd = []
                flg = True
                stroke_sum = 0
                for i in ret:
                    if i:
                        k = str(int(i, 16))
                        if k in word_list:
                            wd.append(word_list[k])
                            stroke_sum += word_stroke_len[k]
                        else:
                            flg = False
                            break
                if flg and stroke_sum <= max_stroke_sum:
                    self.word_list.append(wd)
            print('get {} after idioms'.format(len(self.word_list)))
        if ci_path is not None:
            ci_data = None
            with open(ci_path, 'r') as f:
                ci_data = json.load(f)
            print('json loads {}'.format(len(ci_data)))

            if self.word_list == {}:
                self.word_list = []
            # ci_data = random.sample(ci_data, 5)
            # ci_data = random.sample(ci_data, 50000)
            for dt in ci_data:
                wd = dt['ci']
                if '(' in wd:
                    continue
                ret = wd.encode('unicode_escape').decode().split('\\u')
                wd = []
                flg = True
                stroke_sum = 0
                for i in ret:
                    if i:
                        if not is_hex_number(i):
                            flg = False 
                            break
                        k = str(int(i, 16))
                        if k in word_list:
                            wd.append(word_list[k])
                            stroke_sum += word_stroke_len[k]
                        else:
                            flg = False
                            break
                if flg and stroke_sum <= max_stroke_sum:
                    self.word_list.append(wd)
            print('get {} after ci'.format(len(self.word_list)))
        if shi_path is not None:
            shi_data = None
            with open(shi_path, 'r') as f:
                shi_data = json.load(f)
            print('json loads {}'.format(len(shi_data)))

            if self.word_list == {}:
                self.word_list = []
            # shi_data = random.sample(shi_data, 1)
            # shi_data = random.sample(shi_data, 10000)
            for dt in shi_data:
                # wd = dt['content'].split('，|\n|。') 这个不行
                wd = re.split('，|。|\n', dt['content'])
                for st in wd:
                    if st == '' or type(st) != str:
                        continue
                    ret = st.encode('unicode_escape').decode().split('\\u')
                    st = []
                    flg = True
                    stroke_sum = 0
                    for i in ret:
                        if i:
                            if not is_hex_number(i):
                                flg = False 
                                break
                            k = str(int(i, 16))
                            if k in word_list:
                                st.append(word_list[k])
                                stroke_sum += word_stroke_len[k]
                            else:
                                flg = False
                                break
                    if flg and stroke_sum <= max_stroke_sum:
                        self.word_list.append(st)
            print('get {} after shi'.format(len(self.word_list)))
        if idiom_path is None and ci_path is None and ci_path is None:
            self.word_list = []
            flg = True
            wd = []
            ret = prompt.encode('unicode_escape').decode().split('\\u')
            idx = 0
            for i in ret:
                if i:
                    k = str(int(i, 16))
                    if k in word_list:
                        wd.append(word_list[k])
                    idx = idx + 1
            self.word_list.append(wd)
        print('get {} words'.format(len(self.word_list)))

        # for i in tqdm.tqdm(word_list):
        #     idx = random.sample(range(0, len(word_list)), 10)
        #     for j in idx:
        #         self.word_list.append([i, word_list[j]])
        # print(self.is_pad)
        # print(len(self.word_list[0]))
        self.transform = transform

    def __len__(self):
        return len(self.word_list)

    def __getitem__(self, index):

        word = self.word_list[index]


        # for i in range(len(word)):
        #     if len(word[i]) < self.fixed_length:
        #         print(len(word[i]))
        #         extension_count = self.fixed_length - len(word[i])
        #         extension_elements = [self.empty_token] * extension_count
        #         word[i].extend(extension_elements)
        # print(len(stroke))
        # if len(word) > 64:
        #     print(len(word))

        word = torch.tensor(word)
        # print(word.shape)

        if self.is_normalization:
            word = (word + 1024) / (2.* 1024) 

        return word
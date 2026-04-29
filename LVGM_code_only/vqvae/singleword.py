import numpy as np
from PIL import Image
import xml.etree.ElementTree as ET
import os
import sys

import torch
import torch.utils.data
import torchvision.transforms as transforms

class MyDataset_stage_one(torch.utils.data.Dataset):
    def __init__(self, svg_path, fixed_stroke_length=48, fixed_draw_length=64, canvas_size=1024, is_normalization=True, is_pad=True, transform = None):
        super().__init__()
        word_list = []
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
                        if len(proprecessed_stroke) < self.fixed_draw_length:
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
            if self.is_pad and len(storke_list) < self.fixed_stroke_length:
                extension_count = self.fixed_stroke_length - len(storke_list)
                extension_elements = [[self.empty_token] * self.fixed_draw_length] * extension_count
                storke_list.extend(extension_elements)
            if self.is_pad and len(storke_list) != self.fixed_stroke_length:
                print('stroke length error {}'.format(len(storke_list)))
            word_list.append(storke_list)
        print('Read {} words'.format(len(word_list)))
        # print(word_list)
        self.word_list = word_list
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
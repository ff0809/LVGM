import numpy as np
from PIL import Image
import xml.etree.ElementTree as ET
import os
import sys

import torch
import torch.utils.data
import torchvision.transforms as transforms

class MyDataset_stage_one(torch.utils.data.Dataset):
    def __init__(self, svg_path, fixed_length=64, canvas_size=1024, is_normalization=True, transform = None):
        super().__init__()
        storke_list = []
        self.svg_path = svg_path
        self.fixed_length = fixed_length
        self.canvas_size = canvas_size
        self.is_normalization = is_normalization

        stroke_cnt = [0,0,0,0]
        inst_cnt = [0,0,0,0,0,0,0]

        for file in os.listdir(svg_path):
            tree = ET.parse(os.path.join(svg_path, file))
            root = tree.getroot()

            stk = 0
            for g in root.findall('{http://www.w3.org/2000/svg}g'):
                if g.attrib.get('transform'):
                    for path in g.findall('{http://www.w3.org/2000/svg}path'):
                        clip_path = path.attrib.get('clip-path', '')
                        if clip_path:
                            clip_path = clip_path[5:-1]
                            clip_path = root.find(f".//*[@id='{clip_path}']")
                            stroke = clip_path.find('{http://www.w3.org/2000/svg}path').attrib['d'].split(' ')
                            proprecessed_stroke = []
                            for i in range(len(stroke)):
                                if stroke[i] == "M":
                                    sx = float(stroke[i + 1])
                                    sy = float(stroke[i + 2]) * -1. + 900. #900为偏移量，-1表示旋转
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
                            inst = len(proprecessed_stroke)
                            if inst < 10:
                                inst_cnt[0] = inst_cnt[0]+1
                            elif inst < 20:
                                inst_cnt[1] = inst_cnt[1]+1
                            elif inst < 30:
                                inst_cnt[2] = inst_cnt[2]+1
                            elif inst < 40:
                                inst_cnt[3] = inst_cnt[3]+1
                            elif inst < 50:
                                inst_cnt[4] = inst_cnt[4]+1
                            elif inst < 60:
                                inst_cnt[5] = inst_cnt[5]+1
                            else:
                                inst_cnt[6] = inst_cnt[6]+1
                            storke_list.append(proprecessed_stroke)
                            stk = stk + 1
                
            if stk < 10:
                stroke_cnt[0] = stroke_cnt[0]+1
            elif stk < 20:
                stroke_cnt[1] = stroke_cnt[1]+1
            elif stk < 30:
                stroke_cnt[2] = stroke_cnt[2]+1
            else:
                stroke_cnt[3] = stroke_cnt[3]+1
        
        print(inst_cnt)
        print(stroke_cnt)
        self.storke_list = storke_list
        # print(self.storke_list)
        self.empty_token = [0., 0., 0., 0., 0., 0.]
        self.transform = transform

    def __len__(self):
        return len(self.storke_list)

    def __getitem__(self, index):

        stroke = self.storke_list[index]

        if len(stroke) < self.fixed_length:
            extension_count = self.fixed_length - len(stroke)
            extension_elements = [self.empty_token] * extension_count
            stroke.extend(extension_elements)
        # print(len(stroke))

        stroke = torch.tensor(stroke)

        if self.is_normalization:
            stroke = (stroke + 1024) / (2.* 1024) 

        return stroke
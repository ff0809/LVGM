import numpy as np
from PIL import Image
import xml.etree.ElementTree as ET
import os
import sys

import torch
import torch.utils.data
import torchvision.transforms as transforms

import re

def findStroke(g):
    stroke_list = []
    for stroke in g:
        if stroke.tag != '{http://www.w3.org/2000/svg}path':
            if stroke.tag == '{http://www.w3.org/2000/svg}g':
                stroke_list.extend(findStroke(stroke))
            continue
        proprecessed_stroke = []
        stroke = re.split('(,|-|M|m|c|C|s|S|Q|q|L|l|Z|z|V|v|H|h|\s)', stroke.attrib['d'])
        tg = False
        tmp = []
        for i in range(len(stroke)):
            if stroke[i] == '':
                continue
            if stroke[i] == '-':
                tg = True
                continue
            if tg:
                stroke[i] = '-'+stroke[i]
                tg=False
            if stroke[i][0] in '0123456789.-':
                dotpos = -1
                for j in range(len(stroke[i])):
                    if stroke[i][j] == '.':
                        if dotpos != -1:
                            tmp.append(stroke[i][dotpos:j])
                            dotpos = j
                        else:
                            dotpos = 0
                if dotpos == -1:
                    dotpos = 0
                if dotpos != len(stroke[i]):
                    tmp.append(stroke[i][dotpos:])
            else:
                tmp.append(stroke[i])
        stroke = tmp
        stroke = list(filter(lambda x: x and x != "," and x != "-" and x != " ", stroke))
        lstopt = ''
        for i in range(len(stroke)):
            if stroke[i] == "M" or stroke[i] == 'm':
                # sx = float(stroke[i + 1])
                # sy = float(stroke[i + 2])
                ssx = float(stroke[i + 1])*3.2
                ssy = float(stroke[i + 2])*3.2
                sx = 0.
                sy = 0.
                lstopt = stroke[i]
            elif stroke[i] == "C" or stroke[i] == 'c':
                if stroke[i] == 'C':
                    cx1 = float(stroke[i + 1])*3.2 - ssx
                    cy1 = float(stroke[i + 2])*3.2 - ssy
                    cx2 = float(stroke[i + 3])*3.2 - ssx
                    cy2 = float(stroke[i + 4])*3.2 - ssy
                    ex = float(stroke[i + 5])*3.2 - ssx
                    ey = float(stroke[i + 6])*3.2 - ssy
                else:
                    cx1 = sx + float(stroke[i + 1])*3.2
                    cy1 = sy + float(stroke[i + 2])*3.2
                    cx2 = sx + float(stroke[i + 3])*3.2
                    cy2 = sy + float(stroke[i + 4])*3.2
                    ex = sx + float(stroke[i + 5])*3.2
                    ey = sy + float(stroke[i + 6])*3.2
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == 's' or stroke[i] == 'S':
                if stroke[i] == 'S':
                    cx2 = float(stroke[i + 1])*3.2 - ssx
                    cy2 = float(stroke[i + 2])*3.2 - ssy
                    if lstopt == 'C' or lstopt == 'c' or lstopt == 'S' or lstopt == 's':
                        cx1 = proprecessed_stroke[-1][4]
                        cy1 = proprecessed_stroke[-1][5]
                    else:
                        cx1 = cx2
                        cy1 = cy2
                    ex = float(stroke[i + 3])*3.2 - ssx
                    ey = float(stroke[i + 4])*3.2 - ssy
                else:
                    cx2 = sx + float(stroke[i + 1])*3.2
                    cy2 = sy + float(stroke[i + 2])*3.2
                    if lstopt == 'C' or lstopt == 'c' or lstopt == 'S' or lstopt == 's':
                        cx1 = proprecessed_stroke[-1][4]
                        cy1 = proprecessed_stroke[-1][5]
                    else:
                        cx1 = cx2
                        cy1 = cy2
                    ex = sx + float(stroke[i + 3])*3.2
                    ey = sy + float(stroke[i + 4])*3.2
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == "Q" or stroke[i] == 'q':
                if stroke[i] == 'Q':
                    cx = float(stroke[i + 1])*3.2 - ssx
                    cy = float(stroke[i + 2])*3.2 - ssy
                    ex = float(stroke[i + 3])*3.2 - ssx
                    ey = float(stroke[i + 4])*3.2 - ssy
                else:
                    cx = sx + float(stroke[i + 1])*3.2
                    cy = sy + float(stroke[i + 2])*3.2
                    ex = sx + float(stroke[i + 3])*3.2
                    ey = sy + float(stroke[i + 4])*3.2
                cx1 = sx + 2. / 3. * (cx - sx)
                cy1 = sy + 2. / 3. * (cy - sy)
                cx2 = ex + 2. / 3. * (cx - ex)
                cy2 = ey + 2. / 3. * (cy - ey)
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == "L" or stroke[i] == 'l':
                if stroke[i] == 'L':
                    ex = sx + float(stroke[i + 1])*3.2 - ssx
                    ey = sy + float(stroke[i + 2])*3.2 - ssy
                else:
                    ex = sx + float(stroke[i + 1])*3.2
                    ey = sy + float(stroke[i + 2])*3.2
                cx = ex
                cy = ey
                cx1 = sx + 2. / 3. * (cx - sx)
                cy1 = sy + 2. / 3. * (cy - sy)
                cx2 = ex + 2. / 3. * (cx - ex)
                cy2 = ey + 2. / 3. * (cy - ey)
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == "Z" or stroke[i] == 'z':
                ex = 0.
                ey = 0.
                cx = ex
                cy = ey
                cx1 = sx + 2. / 3. * (cx - sx)
                cy1 = sy + 2. / 3. * (cy - sy)
                cx2 = ex + 2. / 3. * (cx - ex)
                cy2 = ey + 2. / 3. * (cy - ey)
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == 'V' or stroke[i] == 'v':
                ex = sx
                if stroke[i] == 'V':
                    ey = float(stroke[i + 1])*3.2 - ssy
                else:
                    ey = sy + float(stroke[i + 1])*3.2
                cx = ex
                cy = ey
                cx1 = sx
                cy1 = sy + 2. / 3. * (cy - sy)
                cx2 = ex
                cy2 = ey + 2. / 3. * (cy - ey)
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == 'H' or stroke[i] == 'h':
                if stroke[i] == 'H':
                    ex = float(stroke[i + 1])*3.2 - ssx
                else:
                    ex = sx + float(stroke[i + 1])*3.2
                ey = sy
                cx = ex
                cy = ey
                cx1 = sx + 2. / 3. * (cx - sx)
                cy1 = sy
                cx2 = ex + 2. / 3. * (cx - ex)
                cy2 = ey
                proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
                sx = ex
                sy = ey
                lstopt = stroke[i]
            elif stroke[i] == "T" or stroke[i] == "A":
                print("----------------???--------------")
            # if stroke[i] in "cCsSQqLlZzVvHh":
            #     print(stroke[i])
            #     print(proprecessed_stroke[-1])
        stroke_list.append(proprecessed_stroke)
        # if len(proprecessed_stroke) > 64:
        #     print(g)
        #     print(len(proprecessed_stroke))
        #     exit(0)
    return stroke_list

class MyDataset_stage_one(torch.utils.data.Dataset):
    def __init__(self, svg_path, fixed_length=64, canvas_size=1024, is_normalization=True, transform = None):
        super().__init__()
        storke_list = []
        self.svg_path = svg_path
        self.fixed_length = fixed_length
        self.canvas_size = canvas_size
        self.is_normalization = is_normalization

        for file in os.listdir(svg_path):
            tree = ET.parse(os.path.join(svg_path, file))
            root = tree.getroot()
            # print(file)
            nowstroke = findStroke(root)
            storke_list.extend(nowstroke)
        
        self.storke_list = storke_list
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
        # print(stroke.shape)

        if self.is_normalization:
            stroke = (stroke + 1024) / (2.* 1024) 

        return stroke
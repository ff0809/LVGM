import numpy as np
from PIL import Image
import xml.etree.ElementTree as ET
import os
import sys

import torch
import torch.utils.data
import torchvision.transforms as transforms

import re

def proprecesse_stroke(stroke, ct, pp):
    proprecessed_stroke = []
    for i in range(len(stroke)):
        if stroke[i] == "M":
            sx = float(stroke[i + 1]) * ct + pp
            sy = float(stroke[i + 2]) * ct + pp
            lstopt = stroke[i]
        elif stroke[i] == 'C':
            cx1 = float(stroke[i + 1]) * ct + pp
            cy1 = float(stroke[i + 2]) * ct + pp
            cx2 = float(stroke[i + 3]) * ct + pp
            cy2 = float(stroke[i + 4]) * ct + pp
            ex = float(stroke[i + 5]) * ct + pp
            ey = float(stroke[i + 6]) * ct + pp
            proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
            sx = ex
            sy = ey
        elif stroke[i] in "Q":
            cx = float(stroke[i + 1]) * ct + pp
            cy = float(stroke[i + 2]) * ct + pp
            ex = float(stroke[i + 3]) * ct + pp
            ey = float(stroke[i + 4]) * ct + pp
            cx1 = sx + 2. / 3. * (cx - sx)
            cy1 = sy + 2. / 3. * (cy - sy)
            cx2 = ex + 2. / 3. * (cx - ex)
            cy2 = ey + 2. / 3. * (cy - ey)
            proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
            sx = ex
            sy = ey
        elif stroke[i] in "LVH":
            if stroke[i] == "V":
                ex = sx
                ey = float(stroke[i + 1]) * ct + pp
            elif stroke[i] == "H":
                ex = float(stroke[i + 1]) * ct + pp
                ey = sy
            else:
                ex = float(stroke[i + 1]) * ct + pp
                ey = float(stroke[i + 2]) * ct + pp
            cx = ex
            cy = ey
            cx1 = sx + 2. / 3. * (cx - sx)
            cy1 = sy + 2. / 3. * (cy - sy)
            cx2 = ex + 2. / 3. * (cx - ex)
            cy2 = ey + 2. / 3. * (cy - ey)
            proprecessed_stroke.append([sx, sy, cx1, cy1, cx2, cy2])
            sx = ex
            sy = ey
        elif stroke[i] in "Zz":
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
        elif stroke[i] == "T" or stroke[i] == "A":
            print("----------------???--------------")
    return proprecessed_stroke

class MyDataset_stage_one(torch.utils.data.Dataset):
    def __init__(self, svg_path, fixed_length=96, canvas_size=1024, is_normalization=True, transform = None):
        super().__init__()
        storke_list = []
        self.svg_path = svg_path
        self.fixed_length = fixed_length
        self.canvas_size = canvas_size
        self.is_normalization = is_normalization

        ct = 1.0
        pp = 0

        maxord_len = 0
        maxord_num = 0

        ## statistics count param
        strokes_per_glyph = [0, 0, 0, 0]
        inst_per_stroke = [0, 0, 0, 0, 0, 0, 0, 0]

        for file in os.listdir(svg_path):
            tree = ET.parse(os.path.join(svg_path, file))
            root = tree.getroot()

            numcnt = 0
            for g in root.findall('{http://www.w3.org/2000/svg}g'):
                if g.attrib.get('transform'):
                    tg = False
                    for path in g.findall('{http://www.w3.org/2000/svg}path'):
                        tg = True
                        stroke = path.attrib['d'].split(' ')
                        pro_stroke = proprecesse_stroke(stroke, ct, pp)
                        if len(pro_stroke):
                            storke_list.append(pro_stroke)
                            numcnt += 1
                            maxord_len = max(maxord_len, len(storke_list[-1]))
                            ln = len(pro_stroke)
                            if ln < 10:
                                inst_per_stroke[0] += 1
                            elif ln < 20:
                                inst_per_stroke[1] += 1
                            elif ln < 30:
                                inst_per_stroke[2] += 1
                            elif ln < 40:
                                inst_per_stroke[3] += 1
                            elif ln < 50:
                                inst_per_stroke[4] += 1
                            elif ln < 60:
                                inst_per_stroke[5] += 1
                            elif ln < 70:
                                inst_per_stroke[6] += 1
                            else:
                                inst_per_stroke[7] += 1
                    if tg:
                        break
                    for inner_g in g.findall('.//{http://www.w3.org/2000/svg}g'):
                        for path in inner_g.findall('.//{http://www.w3.org/2000/svg}path'):
                            stroke = path.attrib['d'].split(' ')
                            pro_stroke = proprecesse_stroke(stroke, ct, pp)
                            if len(pro_stroke):
                                storke_list.append(pro_stroke)
                                numcnt += 1
                                maxord_len = max(maxord_len, len(storke_list[-1]))
                                ln = len(pro_stroke)
                                if ln < 10:
                                    inst_per_stroke[0] += 1
                                elif ln < 20:
                                    inst_per_stroke[1] += 1
                                elif ln < 30:
                                    inst_per_stroke[2] += 1
                                elif ln < 40:
                                    inst_per_stroke[3] += 1
                                elif ln < 50:
                                    inst_per_stroke[4] += 1
                                elif ln < 60:
                                    inst_per_stroke[5] += 1
                                elif ln < 70:
                                    inst_per_stroke[6] += 1
                                else:
                                    inst_per_stroke[7] += 1
                    break
            maxord_num = max(maxord_num, numcnt)
            if numcnt < 10:
                strokes_per_glyph[0] += 1
            elif numcnt < 20:
                strokes_per_glyph[1] += 1
            elif numcnt < 30:
                strokes_per_glyph[2] += 1
            else:
                strokes_per_glyph[3] += 1
        
        print('max length per order {}'.format(maxord_len))
        print(inst_per_stroke)
        print('max order num per glyph {}'.format(maxord_num))
        print(strokes_per_glyph)
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
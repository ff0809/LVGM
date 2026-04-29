import numpy as np

import torch
import torch.nn as nn
from torch.nn import functional as F

def L2_loss(prediction, target):
    l = prediction - target
    l = l**2
    return torch.mean(l)

def L1_loss(prediction, target):
    l = prediction - target
    l = torch.abs(l)
    return torch.mean(l)

def requires_grad(model, flag=True):
    for p in model.parameters():
        p.requires_grad = flag
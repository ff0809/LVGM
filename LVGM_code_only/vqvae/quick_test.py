# quick_test.py
import time
import sys
import os

print("=" * 60)
print("快速测试 - CPU 模式")
print("=" * 60)

# 1. 测试数据加载
print("\n1. 测试数据加载...")
from dataset import MyDataset_stage_one

start = time.time()
dataset = MyDataset_stage_one(
    "D:/矢量字体生成项目/data/makemeahanzi-master/makemeahanzi-master/svgs",
    fixed_length=100
)
print(f"数据集创建耗时: {time.time() - start:.2f}秒")
print(f"数据集大小: {len(dataset)}")

# 2. 测试单个样本加载
if len(dataset) > 0:
    print("\n2. 测试单个样本处理...")
    start = time.time()
    sample = dataset[0]
    print(f"单个样本处理耗时: {time.time() - start:.2f}秒")

    # 3. 测试模型前向传播
    print("\n3. 测试模型前向传播...")
    try:
        import torch
        from model import Encoder_stage_one, Decoder_stage_one

        # 检测设备
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"使用设备: {device}")

        # 创建模型
        encoder = Encoder_stage_one().to(device)
        decoder = Decoder_stage_one().to(device)

        # 安全处理样本输入
        print(f"原始sample形状: {sample.shape if isinstance(sample, torch.Tensor) else type(sample)}")
        if isinstance(sample, torch.Tensor):
            x = sample.unsqueeze(0).to(device)
            print(f"unsqueeze后x形状: {x.shape}")
            # 调整reshape：假设需要[1,1,H,W]，例如[1,1,100,6]或更大
            if x.shape[1] == 100 and x.shape[2] == 6:
                x = x.view(1, 1, 100, 6)  # [1,1,100,6]，如果需要更大，考虑padding
            elif x.shape == torch.Size([1, 100, 6]):
                x = x.permute(0, 2, 1).unsqueeze(-1)  # 回退到之前，但可能需要padding
        elif isinstance(sample, (list, tuple)) and len(sample) > 0:
            x = sample[0]
            if isinstance(x, torch.Tensor):
                x = x.unsqueeze(0).to(device)
                print(f"unsqueeze后x形状: {x.shape}")
                if x.shape[1] == 100 and x.shape[2] == 6:
                    x = x.view(1, 1, 100, 6)
                elif x.shape == torch.Size([1, 100, 6]):
                    x = x.permute(0, 2, 1).unsqueeze(-1)
            else:
                raise ValueError(f"样本第一个元素类型不支持: {type(x)}")
        else:
            raise ValueError(f"样本类型不支持: {type(sample)}")
        print(f"最终x形状: {x.shape}")

        start = time.time()
        with torch.no_grad():
            encoded = encoder(x, device)
            decoded = decoder(encoded, device)
        print(f"模型前向传播耗时: {time.time() - start:.2f}秒")
        print(f"编码输出形状: {encoded.shape}")
        print(f"解码输出形状: {decoded.shape}")
    except Exception as e:
        print(f"模型测试失败: {e}")

print("\n" + "=" * 60)
print("测试完成！")
print("如果单个样本处理超过5秒，训练会非常慢")
print("=" * 60)
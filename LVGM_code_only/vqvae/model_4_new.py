import torch
import torch.nn as nn
from torch.autograd import Variable
from torch.nn import functional

class ResBlock(nn.Module):
    def __init__(self, dim, h_dim, res_h_dim):
        super().__init__()
        self.block = nn.Sequential(
            nn.ReLU(),
            nn.Conv2d(dim, res_h_dim, 3, 1, 1),
            # nn.BatchNorm2d(res_h_dim),
            nn.ReLU(),
            nn.Conv2d(res_h_dim, h_dim, 1, 1),
            # nn.BatchNorm2d(h_dim)
        )

    def forward(self, x):
        return x + self.block(x)

def weights_init(m):
    classname = m.__class__.__name__
    if classname.find('Conv') != -1:
        try:
            nn.init.xavier_uniform_(m.weight.data)
            m.bias.data.fill_(0)
        except AttributeError:
            print("Skipping initialization of ", classname)

class Encoder_stage_one(nn.Module):
    def __init__(self, input_dim=6, h_dim=1024, res_h_dim=256, embed_dim=16, num_embeds=30000, beta=.25): # 3w2
        super().__init__()
        self.input_dim = input_dim
        self.embed_dim = embed_dim
        self.beta = beta
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels=input_dim, out_channels=h_dim // 2, kernel_size=4, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(h_dim // 2, h_dim, 4, 2, 1),
            nn.ReLU(),
            nn.Conv2d(h_dim, h_dim, 3, 1, 1),
            ResBlock(h_dim, h_dim, res_h_dim),
            ResBlock(h_dim, h_dim, res_h_dim),
            ResBlock(h_dim, h_dim, res_h_dim),
            nn.ReLU()
        )
        self.pre_quantization_conv = nn.Conv2d(h_dim, embed_dim, kernel_size=1, stride=1)
        self.num_embeds = num_embeds
        self.embeds = nn.Embedding(num_embeds, embed_dim)
        self.embeds.weight.data.uniform_(-1.0/num_embeds, 1.0/num_embeds)
        
        self.apply(weights_init)

    def forward(self, x, device):
        ze = self.encoder(x)
        ze = self.pre_quantization_conv(ze)
        
        ze = ze.permute(0, 2, 3, 1).contiguous() # 128, 2, 2, 16
        # print(ze.shape)
        z_flattened = ze.view(-1, self.embed_dim) # 1024, 16
        d = torch.sum(z_flattened ** 2, dim=1, keepdim=True) + \
            torch.sum(self.embeds.weight ** 2, dim=1) - \
            2 * torch.matmul(z_flattened, self.embeds.weight.t()) # 1024, 8192距离

        min_encoding_indices = torch.argmin(d, dim=1).unsqueeze(1) # 1024, 1 压缩了128*2*4之后获得的每个原16对应距离最小的embeds的index
        min_encodings = torch.zeros(min_encoding_indices.shape[0], self.num_embeds).to(device) # 1024, 8192
        min_encodings.scatter_(1, min_encoding_indices, 1) # 1024, 8192

        zq = torch.matmul(min_encodings, self.embeds.weight).view(ze.shape) # 128, 2, 2, 8

        loss = torch.mean((zq.detach() - ze) ** 2) + self.beta * \
                torch.mean((zq - ze.detach()) ** 2)

        zq = ze + (zq - ze).detach()

        # e_mean = torch.mean(min_encodings, dim=0)
        # perplexity = torch.exp(-torch.sum(e_mean * torch.log(e_mean + 1e-10)))

        zq = zq.permute(0, 3, 1, 2).contiguous() # 128, 8, 2, 4

        return ze, zq, loss, min_encoding_indices.squeeze()

    # def get_zq_from_id(self, id, device):
    #     id = id.unsqueeze(1)
    #     # print(id.shape)
    #     min_encodings = torch.zeros(id.shape[0], self.num_embeds).to(device)
    #     # print(min_encodings.shape)
    #     min_encodings.scatter_(1, id, 1)

    #     zq = torch.matmul(min_encodings, self.embeds.weight).view((id.shape[0]//4, 2, 2, 8))
    #     zq = zq.permute(0, 3, 1, 2).contiguous()
    #     return zq
    def get_zq_from_id(self, min_encoding_indices, device):
        
        zq_flattened = self.embeds.weight[min_encoding_indices]
        # print(zq_flattened.shape)
        zq = zq_flattened.view((min_encoding_indices.shape[0]//4, 2, 2, self.embed_dim))#因为压缩128*2*2，所以对应是2*2=4，4个整数index对应一个stroke编码
        zq = zq.permute(0, 3, 1, 2).contiguous()
        return zq

class Decoder_stage_one(nn.Module):
    def __init__(self, in_dim=16, h_dim=1024, res_h_dim=256, out_dim=6):
        super().__init__()
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(in_dim, h_dim, 3, 1, 1),
            ResBlock(h_dim, h_dim, res_h_dim),
            ResBlock(h_dim, h_dim, res_h_dim),
            ResBlock(h_dim, h_dim, res_h_dim),
            nn.ReLU(),
            nn.ConvTranspose2d(h_dim, h_dim // 2, 4, 2, 1),
            nn.ReLU(),
            nn.ConvTranspose2d(h_dim // 2, out_dim, 4, 2, 1)
        )
        self.apply(weights_init)
    
    def forward(self, x):
        return self.decoder(x)

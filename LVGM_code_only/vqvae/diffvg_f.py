import pydiffvg
import torch

pydiffvg.set_use_gpu(torch.cuda.is_available())
# torch.set_printoptions(sci_mode=False)
# pydiffvg.set_use_gpu(False)
# device = torch.device('cpu')


def normalize(x, min_, max_):
    range = max(abs(min_), abs(max_))
    return (x + range) / (2 * range)

def remove_close_to_value(tensor, target=0.5000, tolerance=0.15):
    # Find the last index along the 64 dimension where values are outside the tolerance range
    mask = torch.abs(tensor - target) > tolerance
    valid_indices = torch.where(mask.any(dim=1))[0]
    
    if len(valid_indices) == 0:
        return tensor.new_empty((0, tensor.shape[1]))  # Return an empty tensor if no valid indices
    
    last_valid_index = valid_indices[-1].item()
    
    # Slice the tensor to remove trailing values within the tolerance range
    result = tensor[:last_valid_index + 1, :]
    return result

def vec2raster(all_shapes, device, draw=False, canvas_size=64, color=torch.tensor([1,1,1,0.01]), num=0):
    pydiffvg.set_use_gpu(torch.cuda.is_available())
    # [N张图, 一张图里的n个线]
    # seg1:[size, 64, 6]
    # seg2:[size, 64, 64, 6]
    out = []
    # width=height
    all = all_shapes
    # all = all_shapes*canvas_size*2-canvas_size
    # all = all_shapes*canvas_size
    all.to(device)
    for shape in all:
        shape = remove_close_to_value(shape)*canvas_size*2-canvas_size
        shapes = []
        shape_groups = []
        num_pts = shape.shape[0]
        shape = torch.reshape(shape, (num_pts * 3, 2))
        shape = shape[:torch.nonzero(shape)[-1][0] + 1]  # 去除无效的零点
        num_control_pts = torch.zeros(shape.shape[0]//3).to(device) + 2
        # print(shape)
        shape = shape.contiguous()
        path = pydiffvg.Path(
            num_control_points = num_control_pts,
            points = shape, 
            is_closed = False
        )
        shapes.append(path)
        path_group = pydiffvg.ShapeGroup(
            shape_ids = torch.tensor([len(shapes)-1]).to(device),
            fill_color = color,
            stroke_color = color
        )
        shape_groups.append(path_group)
        scene_args = pydiffvg.RenderFunction.serialize_scene(
            canvas_size, canvas_size, shapes, shape_groups
            )
        # print(scene_args)
        render = pydiffvg.RenderFunction.apply
        out.append(render(canvas_size, canvas_size, 2, 2, 0, None, *scene_args).to(device))
        # if draw:
        #     pydiffvg.imwrite((1-out[-1]).cpu(), 'results/img'+str(num)+'_'+str(shape.shape[0]//3)+'.png')
        #     num += 
        # i += 1
    return torch.stack(out)

def vec2raster_1img(all_shapes, device, draw=False, canvas_size=64, color=torch.tensor([0,0,0,1]), num=0):
    pydiffvg.set_use_gpu(torch.cuda.is_available())
    torch.set_printoptions(sci_mode=False)
    # [N条笔画, 一张图里的n个指令]
    # seg1:[size, 64, 6]
    # seg2:[size, 64, 64, 6]
    out = []
    # width=height
    # print('alllllllll')
    # print(all_shapes)
    all = all_shapes
    # all = all_shapes*canvas_size*2-canvas_size
    # all = all_shapes*canvas_size
    # all = all_shapes
    # print('after')
    # print(all)
    all.to(device)
    num_paths = len(all)
    i = 0
    shapes = []
    shape_groups = []
    for shape in all:
        # print(shape.shape)
        shape = remove_close_to_value(shape)*canvas_size*2-canvas_size
        if not shape.shape[0]:
            continue
        # print(shape)
        shape = shape[:torch.nonzero(shape)[-1][0] + 1]  # 去除无效的零点
        num_pts = shape.shape[0]
        shape = torch.reshape(shape, (num_pts * 3, 2))
        # shape = shape[:torch.nonzero(shape)[-1][0] + 1]  # 去除无效的零点
        # shape = shape*canvas_size*2-1024
        num_control_pts = torch.zeros(shape.shape[0]//3).to(device) + 2
        # print(i)
        # print(shape)
        shape = shape.contiguous()
        path = pydiffvg.Path(
            num_control_points = num_control_pts,
            points = shape, 
            is_closed = True
        )
        shapes.append(path)
        path_group = pydiffvg.ShapeGroup(
            shape_ids = torch.tensor([len(shapes)-1]).to(device),
            fill_color = color,
            stroke_color = color
        )
        shape_groups.append(path_group)
        i += 1

    scene_args = pydiffvg.RenderFunction.serialize_scene(
        canvas_size, canvas_size, shapes, shape_groups
        )
    # print(scene_args)
    render = pydiffvg.RenderFunction.apply
    out.append(render(canvas_size, canvas_size, 2, 2, 0, None, *scene_args).to(device))
        # if draw:
        #     pydiffvg.imwrite((1-out[-1]).cpu(), 'results/img'+str(num)+'_'+str(shape.shape[0]//3)+'.png')
        #     num += 1
    return torch.stack(out)

def vec2raster_1img_outline(all_shapes, device, draw=False, canvas_size=64, color=torch.tensor([0,0,0,1]), num=0):
    pydiffvg.set_use_gpu(torch.cuda.is_available())
    torch.set_printoptions(sci_mode=False)
    # [N条笔画, 一张图里的n个指令]
    # seg1:[size, 64, 6]
    # seg2:[size, 64, 64, 6]
    out = []
    # width=height
    # print('alllllllll')
    # print(all_shapes)
    all = all_shapes
    # all = all_shapes*canvas_size*2-canvas_size
    # all = all_shapes*canvas_size
    # all = all_shapes
    # print('after')
    # print(all)
    all.to(device)
    num_paths = len(all)
    i = 0
    shapes = []
    shape_groups = []
    for shape in all:
        # print(shape.shape)
        shape = remove_close_to_value(shape)*canvas_size*2-canvas_size
        if not shape.shape[0]:
            continue
        # print(shape)
        shape = shape[:torch.nonzero(shape)[-1][0] + 1]  # 去除无效的零点
        num_pts = shape.shape[0]
        shape = torch.reshape(shape, (num_pts * 3, 2))
        # shape = shape[:torch.nonzero(shape)[-1][0] + 1]  # 去除无效的零点
        # shape = shape*canvas_size*2-1024
        num_control_pts = torch.zeros(shape.shape[0]//3).to(device) + 2
        # print(i)
        # print(shape)
        shape = shape.contiguous()
        path = pydiffvg.Path(
            num_control_points = num_control_pts,
            points = shape, 
            is_closed = True,
            stroke_width = torch.tensor(20.0)
        )
        shapes.append(path)
        path_group = pydiffvg.ShapeGroup(
            shape_ids = torch.tensor([len(shapes)-1]).to(device),
            fill_color = torch.tensor([1,1,1,0.01]),
            stroke_color = color
        )
        shape_groups.append(path_group)
        i += 1

    scene_args = pydiffvg.RenderFunction.serialize_scene(
        canvas_size, canvas_size, shapes, shape_groups
        )
    # print(scene_args)
    render = pydiffvg.RenderFunction.apply
    out.append(render(canvas_size, canvas_size, 2, 2, 0, None, *scene_args).to(device))
        # if draw:
        #     pydiffvg.imwrite((1-out[-1]).cpu(), 'results/img'+str(num)+'_'+str(shape.shape[0]//3)+'.png')
        #     num += 1
    return torch.stack(out)
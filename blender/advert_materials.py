"""Shared packed-image material and aspect fit rules for native city adverts."""
import bpy


def load_ad_material(root, file_name, cache, emission=2.0):
    if file_name in cache:
        return cache[file_name]
    path = root / 'public' / 'assets' / file_name
    if not path.is_file():
        raise FileNotFoundError('Campaign image is missing: ' + str(path))
    image = bpy.data.images.load(str(path), check_existing=True)
    image.pack()
    image.use_fake_user = True
    if image.size[0] < 1 or image.size[1] < 1:
        raise ValueError('Campaign has no readable image dimensions: ' + file_name)
    name = 'CAMPAIGN / ' + file_name.removesuffix('.png')
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_fake_user = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeEmission')
    shader.inputs['Strength'].default_value = emission
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.interpolation = 'Closest'
    texture.extension = 'CLIP'
    mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Color'])
    mat.node_tree.links.new(shader.outputs['Emission'], output.inputs['Surface'])
    cache[file_name] = mat
    return mat


def material_image(material):
    return next(node.image for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image)


def panel_dimensions(sign, image):
    """Keep all campaign pixels visible inside the existing engineered frame."""
    width, height = sign['w'] * .96, sign['h'] * .96
    if sign.get('art') == 'campaign':
        aspect = image.size[0] / image.size[1]
        if width / height > aspect:
            width = height * aspect
        else:
            height = width / aspect
    return width, height


def image_quad(sign, image, local_position):
    width, height = panel_dimensions(sign, image)
    return [local_position(sign, dx, dy, .041) for dx, dy in
            [(-width / 2, -height / 2), (width / 2, -height / 2),
             (width / 2, height / 2), (-width / 2, height / 2)]]

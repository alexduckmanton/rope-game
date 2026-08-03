# Attribution

Third-party assets committed into this repository, and the notices that have to
travel with them.

Dependencies installed from npm (Lucide, Inter, Monoton) are not listed here -
their licences ship inside `node_modules` and stay attached to the packages.

## Fluent Emoji

Everything in `public/emoji/`, from Microsoft's Fluent Emoji collection:

| File | Emoji | Source repo | Frames | Size |
|------|-------|-------------|--------|------|
| `fire.webp` | Fire | fluentui-emoji-animated | 48 | 76KB |
| `party-popper.webp` | Party popper | fluentui-emoji-animated | 61 | 192KB |
| `spiral-shell.webp` | Spiral shell | fluentui-emoji-animated | 72 | 157KB |
| `warning.webp` | Warning | fluentui-emoji | still | 2.4KB |
| `gear.webp` | Gear | fluentui-emoji | still | 3.7KB |

- [microsoft/fluentui-emoji-animated](https://github.com/microsoft/fluentui-emoji-animated) - animated PNGs, 256x256
- [microsoft/fluentui-emoji](https://github.com/microsoft/fluentui-emoji) - the 3D stills, 256x256

Only a minority of Fluent Emoji are animated, and the animated set leans
heavily towards faces - most objects and symbols have no animated version. The
animated repo contains a folder only for emoji that do animate, so checking
whether `assets/<Name>/metadata.json` exists there answers it. Warning and Gear
are not animated, which is why they come from the stills repo instead.

The animated ones are resized to 96x96 (64x64 for the flame, which renders much
smaller) and re-encoded from APNG to animated WebP, keeping every frame and the
original loop duration. That takes Party popper from 1.6MB to 192KB.

### Regenerating

```bash
# The raw. URL returns a Git LFS pointer for animated assets, so the bytes come
# from media. The stills repo is not LFS and works from either.
NAME="Party popper"; STEM="party_popper"; SIZE=96; QUALITY=75
curl -L -o source.png "https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/main/assets/${NAME// /%20}/animated/${STEM}_animated.png"

python3 - <<EOF
from PIL import Image, ImageSequence
im = Image.open('source.png')
frames = [f.convert('RGBA').resize(($SIZE, $SIZE), Image.LANCZOS)
          for f in ImageSequence.Iterator(im)]
# Keep the source's own timing rather than assuming a frame rate
total = sum(f.info.get('duration', 42) for f in ImageSequence.Iterator(im))
frames[0].save('out.webp', save_all=True, append_images=frames[1:],
               duration=round(total / len(frames)), loop=0,
               quality=$QUALITY, method=6)
EOF
```

For a still, drop the frame handling and save the single image at quality 90:

```bash
curl -L -o source.png "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Gear/3D/gear_3d.png"
python3 -c "from PIL import Image; Image.open('source.png').convert('RGBA').resize((96,96), Image.LANCZOS).save('out.webp', quality=90, method=6)"
```

### Licence

Both repositories are MIT licensed:

> MIT License
>
> Copyright (c) Microsoft Corporation.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE

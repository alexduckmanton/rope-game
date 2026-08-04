# Attribution

Third-party assets committed into this repository, and the notices that have to
travel with them.

Dependencies installed from npm (Lucide, Inter, Monoton) are not listed here -
their licences ship inside `node_modules` and stay attached to the packages.

## Fluent Emoji

`public/streak-flame.webp` - the animated flame beside the daily streak count.

Derived from `assets/Fire/animated/fire_animated.png` in
[microsoft/fluentui-emoji-animated](https://github.com/microsoft/fluentui-emoji-animated),
resized from 256x256 to 64x64 and re-encoded from APNG to animated WebP
(quality 85). All 48 frames and the original 2.016s loop are kept.

To regenerate it, download the source APNG and run:

```bash
# The raw. URL returns a Git LFS pointer, so the bytes come from media.
curl -L -o fire_animated.png \
  "https://media.githubusercontent.com/media/microsoft/fluentui-emoji-animated/main/assets/Fire/animated/fire_animated.png"

python3 - <<'EOF'
from PIL import Image, ImageSequence
frames = [f.convert('RGBA').resize((64, 64), Image.LANCZOS)
          for f in ImageSequence.Iterator(Image.open('fire_animated.png'))]
frames[0].save('streak-flame.webp', save_all=True, append_images=frames[1:],
               duration=42, loop=0, quality=85, method=6)
EOF
```

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

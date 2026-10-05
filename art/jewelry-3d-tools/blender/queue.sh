#!/bin/bash
cd "$(dirname "$0")/.."
mkdir -p renders
export EXPO=-1.0
for s in main front side detail; do
  python3 blender/render.py $s 2000 200 > renders/log_$s.txt 2>&1
  echo "$(date +%T) still $s done" >> renders/progress.txt
done
python3 blender/render.py turntable 720 32 1 180 > renders/log_turntable.txt 2>&1
echo "$(date +%T) turntable done" >> renders/progress.txt
ffmpeg -y -framerate 30 -i renders/turntable/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart renders/gold-hoops-turntable.mp4 > renders/log_ffmpeg.txt 2>&1
echo "$(date +%T) ALL DONE" >> renders/progress.txt

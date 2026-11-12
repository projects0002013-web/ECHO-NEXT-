#!/usr/bin/env bash
set -euo pipefail
cd /workspace/ECHO-NEXT-/echo-next
mkdir -p /workspace/toolchains /workspace/android-sdk/cmdline-tools /workspace/.android /workspace/.gradle
if [[ ! -x /workspace/toolchains/jdk-21.0.13+9/bin/javac ]]; then
  curl -fsSL --max-time 300 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz' -o /tmp/echo-jdk.tar.gz
  printf '%s  %s\n' d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c /tmp/echo-jdk.tar.gz | sha256sum -c -
  tar -xzf /tmp/echo-jdk.tar.gz -C /workspace/toolchains
fi
if [[ ! -x /workspace/android-sdk/cmdline-tools/19.0/bin/sdkmanager ]]; then
  curl -fsSL --max-time 300 https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip -o /tmp/echo-sdk.zip
  printf '%s  %s\n' 5fdcc763663eefb86a5b8879697aa6088b041e70 /tmp/echo-sdk.zip | sha1sum -c -
  python3 - <<'PY'
import zipfile,os
with zipfile.ZipFile('/tmp/echo-sdk.zip') as z:z.extractall('/workspace/android-sdk/cmdline-tools')
os.rename('/workspace/android-sdk/cmdline-tools/cmdline-tools','/workspace/android-sdk/cmdline-tools/19.0')
PY
  chmod +x /workspace/android-sdk/cmdline-tools/19.0/bin/*
fi
source scripts/cloud-env.sh
# Preserve other Gradle settings, derive proxy coordinates without storing credentials.
python3 - <<'PY'
import os,urllib.parse,subprocess
from pathlib import Path
p=urllib.parse.urlparse(os.environ.get('HTTPS_PROXY',''))
props={'systemProp.javax.net.ssl.trustStore':'/etc/ssl/certs/java/cacerts','org.gradle.jvmargs':'-Xmx2048m'}
args=['/workspace/android-sdk/cmdline-tools/19.0/bin/sdkmanager','--sdk_root=/workspace/android-sdk']
if p.hostname and p.port:
    args+=['--proxy=http',f'--proxy_host={p.hostname}',f'--proxy_port={p.port}']
    for scheme in ['http','https']:
        props[f'systemProp.{scheme}.proxyHost']=p.hostname
        props[f'systemProp.{scheme}.proxyPort']=str(p.port)
path=Path('/workspace/.gradle/gradle.properties')
lines=path.read_text().splitlines() if path.exists() else []
lines=[line for line in lines if line.split('=',1)[0] not in props]
path.write_text('\n'.join(lines+[f'{k}={v}' for k,v in props.items()])+'\n')
required=['platforms/android-35/android.jar','build-tools/34.0.0/aapt2','build-tools/35.0.0/aapt2','platform-tools/adb']
if not all(Path('/workspace/android-sdk',f).exists() for f in required):
    # Android SDK licenses are accepted for the requested Android build workflow.
    subprocess.run(args+['--licenses'],input='y\n'*100,text=True,check=True)
    subprocess.run(args+['platforms;android-35','build-tools;34.0.0','build-tools;35.0.0','platform-tools'],check=True)
Path('android/local.properties').write_text('sdk.dir=/workspace/android-sdk\n')
PY
npm ci --no-audit --no-fund --cache /workspace/.npm
npm run build
npm test
npx cap sync android

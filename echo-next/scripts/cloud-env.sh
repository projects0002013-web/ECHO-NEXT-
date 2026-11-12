# Source from the project root in the managed cloud environment.
export JAVA_HOME=/workspace/toolchains/jdk-21.0.13+9
export ANDROID_HOME=/workspace/android-sdk
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_USER_HOME=/workspace/.android
export ANDROID_SDK_HOME=/workspace
export GRADLE_USER_HOME=/workspace/.gradle
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"

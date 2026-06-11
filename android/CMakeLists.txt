project(KycSdkReactNative)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME KycSdkReactNative)
set(CMAKE_CXX_STANDARD 20)

# Our only hand-written C++: the JNI_OnLoad that registers the Nitro HybridObjects.
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
)

# Add the nitrogen-generated specs + autolinking (adds sources, includes, and links
# fbjni / ReactAndroid / react-native-nitro-modules to ${PACKAGE_NAME}).
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/KycSdkReactNative+autolinking.cmake)

# Our Nitro spec's `Frame` type comes from VisionCamera, so the generated C++
# includes <VisionCamera/HybridFrameSpec.hpp> — link VisionCamera's prefab to put
# its headers on the include path. (Nitrogen doesn't auto-link external-module
# prefabs, so we add it by hand.)
find_package(react-native-vision-camera REQUIRED CONFIG)

find_library(LOG_LIB log)

target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android
        react-native-vision-camera::VisionCamera
)

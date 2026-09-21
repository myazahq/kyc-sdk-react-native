# Consumer R8 / ProGuard rules for @myazahq/kyc-sdk-react-native.
#
# Merged into the host app's shrinker configuration automatically through
# `consumerProguardFiles`, so an integrator who enables R8 (`minifyEnabled true`,
# `shrinkResources true`) needs nothing on their side. Enabling R8 is the single
# biggest thing an integrator can do for the Java half of the SDK's footprint:
# the unminified dex the SDK pulls in (CameraX, Play Services shims, Expo, Kotlin
# reflection) is mostly code no flow ever calls.
#
# Nitro constructs every hybrid implementation BY CLASS NAME from C++: the
# generated OnLoad registers one JNI constructor per spec, which the shrinker
# cannot see. A shrunk build without these rules removes exactly the classes the
# registry then fails to find, and the failure is a crash at the first camera
# frame rather than a build error.
-keep class com.margelo.nitro.** { *; }
-keep class co.myazahq.kyc.rn.** { *; }

# JJ2000, the JPEG 2000 decoder for the chip portrait, predates the shrinker
# era. Keeping it whole costs about 0.3 MB and takes a whole class of
# shrink-time surprises out of a decode that runs once per chip read.
-keep class jj2000.** { *; }
-dontwarn jj2000.**

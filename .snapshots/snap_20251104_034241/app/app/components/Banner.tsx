import React from "react";
import { View, Text, ImageBackground, useWindowDimensions } from "react-native";
import { theme } from "../../constants/theme";

export default function Banner() {
  const { width } = useWindowDimensions();
  const bannerHeight = width < 600 ? 180 : 260; // responsive height

  return (
    <View
      style={{
        width: "100%",
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 20,
        height: bannerHeight,
        backgroundColor: theme.colors.surface,
        justifyContent: "flex-end",
      }}
    >
      <ImageBackground
        source={require("../../assets/banner_toronto_bengali.png")}
        resizeMode="cover"
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          justifyContent: "flex-end",
        }}
        imageStyle={{
          opacity: 0.95,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.4)",
            padding: 16,
          }}
        >
          <Text
            style={{
              color: theme.colors.white,
              fontSize: 26,
              fontWeight: "900",
            }}
          >
            HomeChef
          </Text>
          <Text
            style={{
              color: theme.colors.white,
              fontSize: 15,
              fontWeight: "500",
              opacity: 0.9,
            }}
          >
            Toronto · Bangladeshi community cooking together
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

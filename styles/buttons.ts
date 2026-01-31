import { theme } from "../../constants/theme";
import { Platform } from "react-native";

export const buttonStyles = {
  base: {
    backgroundColor: theme.colors.primary, // 🔴 red buttons
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        // RN Web: shadow* is deprecated; use boxShadow
        boxShadow: `0 4px 6px rgba(254, 115, 76, 0.4)`,
      },
      ios: {
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  text: {
    color: theme.colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
};

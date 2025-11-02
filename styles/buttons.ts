import { theme } from "../../constants/theme";

export const buttonStyles = {
  base: {
    backgroundColor: theme.colors.primary, // 🔴 red buttons
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  text: {
    color: theme.colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
};

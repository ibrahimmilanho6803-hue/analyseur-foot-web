import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

// Vrai tant que le clavier du téléphone est affiché (la barre d'onglets se masque alors pour laisser la place).
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setVisible(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return visible;
}

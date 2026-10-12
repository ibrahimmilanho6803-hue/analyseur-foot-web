import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

test("l'environnement de test fonctionne", async () => {
  await render(<Text>Analyseur Foot Pro</Text>);
  expect(screen.getByText("Analyseur Foot Pro")).toBeTruthy();
});

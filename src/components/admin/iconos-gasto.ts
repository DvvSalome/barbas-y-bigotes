import type { ReactElement } from "react";
import {
  BoxIcon,
  BoltIcon,
  BuildingIcon,
  CupIcon,
  DropIcon,
  KeyIcon,
  LandmarkIcon,
  MegaphoneIcon,
  PaperIcon,
  ReceiptIcon,
  RepeatIcon,
  SprayIcon,
  TagIcon,
  WifiIcon,
  WrenchIcon,
} from "@/components/icons";

// El icono de cada categoría de gasto: se reconoce antes de leer. Monocromos a
// propósito (el color en este panel significa algo: rojo es acción, ámbar es aviso).
//
// Vive aparte de CuadreForms porque aquel es "use client" y el reporte del mes es
// un Server Component: de un módulo de cliente, el servidor recibe referencias,
// no el objeto. Una categoría escrita a mano ("Otra") cae en la etiqueta.
const ICONO_GASTO: Record<string, (p: { className?: string }) => ReactElement> = {
  Insumos: BoxIcon,
  Aseo: SprayIcon,
  Papelería: PaperIcon,
  Servicios: ReceiptIcon,
  Comida: CupIcon,
  Arreglos: WrenchIcon,
  Arriendo: KeyIcon,
  Luz: BoltIcon,
  Agua: DropIcon,
  "Internet y teléfono": WifiIcon,
  Impuestos: LandmarkIcon,
  Administración: BuildingIcon,
  Publicidad: MegaphoneIcon,
  Suscripciones: RepeatIcon,
};

export const iconoDeGasto = (categoria: string) => ICONO_GASTO[categoria] ?? TagIcon;

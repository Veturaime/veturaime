export type PlanSlug = "free" | "plus";

export type PlanStatus = "Free" | "Plus";

export type PlanDefinition = {
  slug: PlanSlug;
  status: PlanStatus;
  name: string;
  priceLabel: string;
  durationLabel: string;
  description: string;
  features: string[];
  ctaLabel: string;
};

export const plans: Record<PlanSlug, PlanDefinition> = {
  free: {
    slug: "free",
    status: "Free",
    name: "Plani Bazë",
    priceLabel: "0€",
    durationLabel: "1 muaj falas",
    description: "Fillo menjëherë dhe menaxho veturën me funksionet bazë.",
    features: [
      "Shërbime bazë për menaxhim",
      "Ruajtje e dokumenteve kryesore",
      "Përllogaritje e thjeshtë e shpenzimeve",
      "Mbështetje standarde"
    ],
    ctaLabel: "Fillo tani"
  },
  plus: {
    slug: "plus",
    status: "Plus",
    name: "Bazë Plus",
    priceLabel: "10€",
    durationLabel: "1 vit",
    description: "Zgjidh pakon vjetore për njoftime më të avancuara dhe raportim më të plotë.",
    features: [
      "Të gjitha veçoritë e Basic",
      "Njoftime të avancuara për afate",
      "Raporte më të detajuara mujore",
      "Mbështetje prioritare"
    ],
    ctaLabel: "Fillo tani"
  }
};

export function parsePlanSlug(planParam: string | null): PlanSlug | null {
  if (planParam === "free" || planParam === "plus") {
    return planParam;
  }

  return null;
}
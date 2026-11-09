import { createAgendaSlide } from "@/lib/agenda/agenda-elements";
import { createDefaultAgenda } from "@/lib/agenda/agenda-model";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";

const ID = "wknd-agenda-spotlight";

export const WKND_AGENDA_SPOTLIGHT_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Agenda Spotlight",
  category: "agenda",
  slide: createAgendaSlide(createDefaultAgenda("spotlight", ID), `layout-${ID}`),
};

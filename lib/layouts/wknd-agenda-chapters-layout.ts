import { createAgendaSlide } from "@/lib/agenda/agenda-elements";
import { createDefaultAgenda } from "@/lib/agenda/agenda-model";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";

const ID = "wknd-agenda-chapters";

export const WKND_AGENDA_CHAPTERS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "What's Inside",
  category: "agenda",
  slide: createAgendaSlide(createDefaultAgenda("chapters", ID), `layout-${ID}`),
};

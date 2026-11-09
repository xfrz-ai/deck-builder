import { createAgendaSlide } from "@/lib/agenda/agenda-elements";
import { createDefaultAgenda } from "@/lib/agenda/agenda-model";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";

const ID = "wknd-agenda";

export const WKND_AGENDA_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Today's Agenda",
  category: "agenda",
  slide: createAgendaSlide(createDefaultAgenda("schedule", ID), `layout-${ID}`),
};

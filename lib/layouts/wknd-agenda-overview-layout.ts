import { createAgendaSlide } from "@/lib/agenda/agenda-elements";
import { createDefaultAgenda } from "@/lib/agenda/agenda-model";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";

const ID = "wknd-agenda-overview";

export const WKND_AGENDA_OVERVIEW_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "On the Agenda",
  category: "agenda",
  slide: createAgendaSlide(createDefaultAgenda("cards", ID), `layout-${ID}`),
};

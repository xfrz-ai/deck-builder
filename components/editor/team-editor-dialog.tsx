"use client";

import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  GeneratorDialog,
  generatorInputClassName,
} from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import { SwitchIndicator } from "@/components/ui/switch";
import { IMAGE_FILE_ACCEPT } from "@/lib/image/image-file";
import {
  createTeamGraphicPreview,
  estimateTeamText,
  getTeamErrors,
  type MeasureTeamText,
} from "@/lib/team/team-elements";
import {
  cloneTeam,
  createTeamGroup,
  createTeamPerson,
  getTeamLimits,
  getTeamMembers,
  getTeamPeopleCount,
  teamHasLeader,
} from "@/lib/team/team-model";
import { loadTeamPhoto } from "@/lib/team/team-photo";
import { getCanvasFont, measureTextWidth } from "@/lib/text/measure-text";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { TeamEditorSession, TeamGroup, TeamLeader, TeamPerson } from "@/types/team";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="block">{label}</span>
      {children}
      {error ? <span className="block leading-4 text-destructive" role="alert">{error}</span> : null}
    </label>
  );
}

function MemberPhoto({
  member,
  uploading,
  error,
  onUpload,
  onRemove,
}: {
  member: TeamPerson;
  uploading: boolean;
  error?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          aria-label={member.photo ? `${member.name || "Member"} photo` : "No member photo"}
          className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface-03 bg-cover bg-center text-sm font-semibold text-muted-foreground"
          role="img"
          style={member.photo ? { backgroundImage: `url("${member.photo.src}")` } : undefined}
        >
          {!member.photo ? (Array.from(member.name.trim())[0]?.toUpperCase() ?? "?") : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button disabled={uploading} onClick={() => inputRef.current?.click()} size="sm" variant="outline">
            {uploading ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {uploading ? "Loading…" : member.photo ? "Change photo" : "Upload photo"}
          </Button>
          {member.photo ? (
            <Button aria-label={`Remove ${member.name || "member"} photo`} disabled={uploading} onClick={onRemove} size="icon-sm" variant="ghost">
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <input
          accept={IMAGE_FILE_ACCEPT}
          aria-label={`Choose photo for ${member.name || "member"}`}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onUpload(file);
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
      </div>
      {error ? <p className="text-[11px] leading-4 text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

export function TeamEditorDialog({ session }: { session: TeamEditorSession }) {
  const [data, setData] = useState(() => cloneTeam(session.initialData));
  const [fontReady, setFontReady] = useState(false);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(() => new Set());
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const mountedRef = useRef(true);
  const close = useEditorStore((state) => state.closeTeamEditor);
  const save = useEditorStore((state) => state.saveTeam);
  const previous = useEditorStore((state) => state.presentation.slides.find((slide) => slide.id === session.slideId));

  useEffect(() => {
    mountedRef.current = true;
    Promise.allSettled([
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 24, 400)),
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 40, 700)),
    ]).then(() => {
      if (mountedRef.current) setFontReady(true);
    });
    return () => { mountedRef.current = false; };
  }, []);

  const measure = useMemo<MeasureTeamText>(() => (text, size, weight = 400, spacing = 0) => {
    const width = fontReady ? measureTextWidth(text, "Plus Jakarta Sans", size, weight >= 600 ? 700 : 400) : null;
    return width === null
      ? estimateTeamText(text, size, weight, spacing)
      : width + Math.max(0, Array.from(text).length - 1) * spacing;
  }, [fontReady]);
  const errors = useMemo(() => getTeamErrors(data, measure), [data, measure]);
  const preview = useMemo(() => createTeamGraphicPreview(data, measure, previous?.background, previous?.darkMode), [data, measure, previous?.background, previous?.darkMode]);
  const members = getTeamMembers(data);
  const leader = data.leader;
  const peopleCount = getTeamPeopleCount(data);
  const limits = getTeamLimits(data.variant);
  const hasLeads = teamHasLeader(data.variant);
  const hasErrors = Object.keys(errors).length > 0;
  const uploading = [...members, ...(leader ? [leader] : [])].some((member) => uploadingIds.has(member.id));

  const updateGroup = (groupId: string, updates: Partial<TeamGroup>) => setData((current) => ({
    ...current,
    groups: current.groups.map((group) => group.id === groupId ? { ...group, ...updates } : group),
  }));
  const updateLeader = (updates: Partial<TeamLeader>) => setData((current) => current.leader ? ({
    ...current,
    leader: { ...current.leader, ...updates },
  }) : current);
  const updateMember = (memberId: string, updates: Partial<TeamPerson>) => setData((current) => ({
    ...current,
    ...(current.leader?.id === memberId ? { leader: { ...current.leader, ...updates } } : {}),
    groups: current.groups.map((group) => ({
      ...group,
      members: group.members.map((member) => member.id === memberId ? { ...member, ...updates } : member),
    })),
  }));
  const moveGroup = (index: number, direction: -1 | 1) => setData((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.groups.length) return current;
    const groups = [...current.groups];
    [groups[index], groups[target]] = [groups[target], groups[index]];
    return { ...current, groups };
  });
  const moveMember = (groupId: string, index: number, direction: -1 | 1) => setData((current) => ({
    ...current,
    groups: current.groups.map((group) => {
      if (group.id !== groupId || index + direction < 0 || index + direction >= group.members.length) return group;
      const members = [...group.members];
      [members[index], members[index + direction]] = [members[index + direction], members[index]];
      return { ...group, members };
    }),
  }));
  const transferMember = (memberId: string, targetGroupId: string) => setData((current) => {
    const member = getTeamMembers(current).find((person) => person.id === memberId);
    const target = current.groups.find((group) => group.id === targetGroupId);
    if (!member || !target || target.members.length >= getTeamLimits(current.variant).members || target.members.some((person) => person.id === memberId)) return current;
    return {
      ...current,
      groups: current.groups.map((group) => ({
        ...group,
        members: group.id === targetGroupId ? [...group.members, member] : group.members.filter((person) => person.id !== memberId),
      })),
    };
  });
  const uploadPhoto = async (memberId: string, file: File) => {
    setUploadingIds((current) => new Set(current).add(memberId));
    setPhotoErrors((current) => ({ ...current, [memberId]: "" }));
    try {
      const photo = await loadTeamPhoto(file);
      if (mountedRef.current) updateMember(memberId, { photo });
    } catch (error) {
      if (mountedRef.current) setPhotoErrors((current) => ({
        ...current,
        [memberId]: error instanceof Error ? error.message : "The photo could not be loaded.",
      }));
    } finally {
      if (mountedRef.current) setUploadingIds((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  };

  return (
    <GeneratorDialog
      closeLabel="Close team editor"
      description="Edit the team graphic and its members."
      insertDisabled={!fontReady || hasErrors || uploading || !previous?.team}
      insertLabel="Update team"
      onClose={close}
      onInsert={() => save(data, measure)}
      previewEmptyMessage="Add a team member to see the preview."
      previewNote={!fontReady ? "Loading fonts…" : uploading ? "Preparing the member photo…" : "Update changes the team graphic. Edit slide text directly on the canvas."}
      previewSlide={preview}
      title="Edit our team"
    >
      <fieldset className="space-y-3 rounded-2xl border border-stroke-01 p-3">
        <legend className="px-1 text-xs font-semibold text-primary">Display</legend>
        <div className="space-y-1">
          {([
            { key: "showPhotos", label: "Show photos" },
            { key: "showRoles", label: "Show roles" },
          ] as const).map(({ key, label }) => (
            <button
              aria-checked={data[key]}
              className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-xs font-medium text-primary outline-none hover:bg-surface-03 focus-visible:ring-2 focus-visible:ring-primary"
              key={key}
              onClick={() => setData((current) => ({ ...current, [key]: !current[key] }))}
              role="switch"
              type="button"
            >
              {label}<SwitchIndicator checked={data[key]} />
            </button>
          ))}
        </div>
      </fieldset>

      {leader ? (
        <fieldset className="space-y-3 rounded-2xl border border-stroke-01 p-3">
          <legend className="px-1 text-xs font-semibold text-primary">Leader</legend>
          <MemberPhoto
            error={photoErrors[leader.id]}
            member={leader}
            onRemove={() => {
              updateLeader({ photo: null });
              setPhotoErrors((current) => ({ ...current, [leader.id]: "" }));
            }}
            onUpload={(file) => { void uploadPhoto(leader.id, file); }}
            uploading={uploadingIds.has(leader.id)}
          />
          <Field label="Name" error={fontReady ? errors["leader.name"] : undefined}>
            <input aria-invalid={Boolean(errors["leader.name"])} className={generatorInputClassName} maxLength={80} onChange={(event) => updateLeader({ name: event.target.value })} placeholder="e.g. Frans" value={leader.name} />
          </Field>
          <Field label="Role · optional" error={fontReady ? errors["leader.role"] : undefined}>
            <input className={generatorInputClassName} maxLength={120} onChange={(event) => updateLeader({ role: event.target.value })} placeholder="e.g. Chief Executive Officer" value={leader.role} />
          </Field>
          <Field label="Badge · optional" error={fontReady ? errors["leader.badge"] : undefined}>
            <input className={generatorInputClassName} maxLength={24} onChange={(event) => updateLeader({ badge: event.target.value })} placeholder="e.g. CEO" value={leader.badge} />
          </Field>
        </fieldset>
      ) : null}

      <div className="space-y-1 px-1 pb-1 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-primary">Teams & members</h3>
          <span className="text-[11px] text-muted-foreground">{data.groups.length} {data.groups.length === 1 ? "team" : "teams"} · {peopleCount} {peopleCount === 1 ? "person" : "people"}</span>
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          {data.variant === "people"
            ? "People shows all members in one grid. Use teams to organize the member list."
            : hasLeads
              ? "Add up to five teams, with up to four members in each. The first member is shown as the team lead."
              : "Add up to four teams, with up to three members in each."}
        </p>
      </div>

      {data.groups.map((group, groupIndex) => (
        <fieldset className="space-y-3 rounded-2xl border border-stroke-01 p-3" key={group.id}>
          <legend className="sr-only">Team {groupIndex + 1}</legend>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">Team {String(groupIndex + 1).padStart(2, "0")}</span>
            <div className="flex gap-0.5">
              <Button aria-label={`Move team ${groupIndex + 1} up`} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)} size="icon-sm" variant="ghost"><ArrowUp className="size-3.5" /></Button>
              <Button aria-label={`Move team ${groupIndex + 1} down`} disabled={groupIndex === data.groups.length - 1} onClick={() => moveGroup(groupIndex, 1)} size="icon-sm" variant="ghost"><ArrowDown className="size-3.5" /></Button>
              <Button aria-label={`Remove team ${groupIndex + 1}`} className="text-muted-foreground hover:text-destructive" disabled={data.groups.length === 1} onClick={() => setData((current) => ({ ...current, groups: current.groups.filter(({ id }) => id !== group.id) }))} size="icon-sm" variant="ghost"><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
          <Field label="Team name" error={fontReady ? errors[`${group.id}.name`] : undefined}>
            <input className={generatorInputClassName} maxLength={80} onChange={(event) => updateGroup(group.id, { name: event.target.value })} placeholder="e.g. Design" value={group.name} />
          </Field>
          <Field label="Description · optional" error={fontReady ? errors[`${group.id}.description`] : undefined}>
            <input className={generatorInputClassName} maxLength={160} onChange={(event) => updateGroup(group.id, { description: event.target.value })} placeholder="e.g. Product & brand design" value={group.description} />
          </Field>

          {group.members.map((member, memberIndex) => {
            const memberHasError = fontReady && (errors[`${member.id}.name`] || errors[`${member.id}.role`]);
            return (
              <fieldset className={cn("space-y-3 rounded-xl border p-3", memberHasError ? "border-destructive/40 bg-[#fff6f4]" : "border-stroke-01 bg-surface-02")} key={member.id}>
                <legend className="sr-only">Member {memberIndex + 1}</legend>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary">{hasLeads && memberIndex === 0 ? "Lead" : `Member ${hasLeads ? memberIndex : memberIndex + 1}`}</span>
                  <div className="flex gap-0.5">
                    <Button aria-label={`Move member ${memberIndex + 1} up in team ${groupIndex + 1}`} disabled={memberIndex === 0} onClick={() => moveMember(group.id, memberIndex, -1)} size="icon-sm" variant="ghost"><ArrowUp className="size-3" /></Button>
                    <Button aria-label={`Move member ${memberIndex + 1} down in team ${groupIndex + 1}`} disabled={memberIndex === group.members.length - 1} onClick={() => moveMember(group.id, memberIndex, 1)} size="icon-sm" variant="ghost"><ArrowDown className="size-3" /></Button>
                    <Button aria-label={`Remove member ${memberIndex + 1} from team ${groupIndex + 1}`} className="text-muted-foreground hover:text-destructive" disabled={group.members.length === 1} onClick={() => setData((current) => ({
                      ...current,
                      groups: current.groups.map((item) => item.id === group.id ? { ...item, members: item.members.filter(({ id }) => id !== member.id) } : item),
                    }))} size="icon-sm" variant="ghost"><Trash2 className="size-3" /></Button>
                  </div>
                </div>
                <MemberPhoto
                  error={photoErrors[member.id]}
                  member={member}
                  onRemove={() => {
                    updateMember(member.id, { photo: null });
                    setPhotoErrors((current) => ({ ...current, [member.id]: "" }));
                  }}
                  onUpload={(file) => { void uploadPhoto(member.id, file); }}
                  uploading={uploadingIds.has(member.id)}
                />
                <Field label="Name" error={fontReady ? errors[`${member.id}.name`] : undefined}>
                  <input aria-invalid={Boolean(errors[`${member.id}.name`])} className={generatorInputClassName} maxLength={80} onChange={(event) => updateMember(member.id, { name: event.target.value })} placeholder="e.g. Frans" value={member.name} />
                </Field>
                <Field label="Role · optional" error={fontReady ? errors[`${member.id}.role`] : undefined}>
                  <input className={generatorInputClassName} maxLength={120} onChange={(event) => updateMember(member.id, { role: event.target.value })} placeholder="e.g. Design Lead" value={member.role} />
                </Field>
                {data.groups.length > 1 ? (
                  <Field label="Team">
                    <select className={generatorInputClassName} onChange={(event) => transferMember(member.id, event.target.value)} value={group.id}>
                      {data.groups.map((option, optionIndex) => (
                        <option disabled={option.id !== group.id && option.members.length >= limits.members} key={option.id} value={option.id}>
                          {option.name.trim() || `Team ${optionIndex + 1}`}{option.id !== group.id && option.members.length >= limits.members ? " · full" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </fieldset>
            );
          })}

          {errors[`${group.id}.members`] ? <p className="text-[11px] text-destructive" role="alert">{errors[`${group.id}.members`]}</p> : null}
          <Button className="w-full" disabled={group.members.length >= limits.members} onClick={() => setData((current) => ({
            ...current,
            groups: current.groups.map((item) => item.id === group.id && item.members.length < limits.members ? { ...item, members: [...item.members, createTeamPerson()] } : item),
          }))} size="sm" variant="outline">
            <Plus className="size-3.5" />{group.members.length >= limits.members ? `Maximum ${limits.members} members` : "Add member"}
          </Button>
        </fieldset>
      ))}
      {errors.groups ? <p className="px-1 text-[11px] text-destructive" role="alert">{errors.groups}</p> : null}
      <Button className="w-full shrink-0" disabled={data.groups.length >= limits.groups} onClick={() => setData((current) => current.groups.length < limits.groups ? { ...current, groups: [...current.groups, createTeamGroup()] } : current)} variant="outline">
        <Plus className="size-4" />{data.groups.length >= limits.groups ? `Maximum ${limits.groups} teams` : "Add team"}
      </Button>
      {fontReady && hasErrors ? <p className="px-1 text-[11px] leading-4 text-destructive" role="status">Adjust the highlighted fields to fit the selected design.</p> : null}
    </GeneratorDialog>
  );
}

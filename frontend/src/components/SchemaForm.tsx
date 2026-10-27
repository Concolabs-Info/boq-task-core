"use client";

import type { JsonSchemaProperty, ObservationSchema } from "@/lib/types";

export type FormValues = Record<string, string>;

/** The JSON type of a property, looking inside anyOf for optional fields. */
function fieldType(property: JsonSchemaProperty): string {
  if (property.type) return property.type;
  return property.anyOf?.find((option) => option.type && option.type !== "null")?.type ?? "string";
}

function fieldEnum(property: JsonSchemaProperty) {
  return property.enum ?? property.anyOf?.find((option) => option.enum)?.enum;
}

/** Form values (strings) to observation values. Empty fields are left out so the backend can fill or reject them. */
export function toValues(schema: ObservationSchema, form: FormValues): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema.properties)) {
    const raw = form[name]?.trim();
    if (!raw) continue;
    const type = fieldType(property);
    values[name] = type === "number" || type === "integer" ? Number(raw) : type === "boolean" ? raw === "true" : raw;
  }
  return values;
}

export function toForm(values: Record<string, unknown>): FormValues {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value == null ? "" : String(value)]));
}

/** Inputs for a flat JSON Schema object, the shape every element's observation model produces. */
export function SchemaForm({
  schema,
  value,
  onChange,
}: {
  schema: ObservationSchema;
  value: FormValues;
  onChange: (value: FormValues) => void;
}) {
  const required = new Set(schema.required ?? []);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(schema.properties).map(([name, property]) => {
        const options = fieldEnum(property);
        const type = fieldType(property);
        const set = (text: string) => onChange({ ...value, [name]: text });
        return (
          <label key={name} className="block">
            <span className="label">
              {property.title ?? name}
              {required.has(name) && " *"}
            </span>
            {options ? (
              <select className="input" value={value[name] ?? ""} onChange={(e) => set(e.target.value)}>
                <option value="" />
                {options.map((option) => (
                  <option key={String(option)} value={String(option)}>
                    {String(option)}
                  </option>
                ))}
              </select>
            ) : type === "boolean" ? (
              <select className="input" value={value[name] ?? ""} onChange={(e) => set(e.target.value)}>
                <option value="" />
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                className="input"
                inputMode={type === "number" || type === "integer" ? "decimal" : undefined}
                placeholder={property.default != null ? String(property.default) : undefined}
                value={value[name] ?? ""}
                onChange={(e) => set(e.target.value)}
              />
            )}
            {property.description && <span className="mt-0.5 block text-xs text-slate-500">{property.description}</span>}
          </label>
        );
      })}
    </div>
  );
}

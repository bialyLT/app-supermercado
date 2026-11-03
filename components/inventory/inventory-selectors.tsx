"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ProductCombobox, type ProductComboboxOption } from "../product-combobox";

const uuidSchema = z.string().uuid();

const operationalLocationSchema = z.object({
  id: uuidSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  branchId: uuidSchema,
  active: z.boolean(),
});

export const operationalContextSchema = z.object({
  tenantId: uuidSchema,
  branches: z.array(
    z.object({
      id: uuidSchema,
      code: z.string().min(1),
      name: z.string().min(1),
      locations: z.array(operationalLocationSchema),
    }),
  ),
  locations: z.array(operationalLocationSchema),
});

export type OperationalSelectorLocation = z.infer<typeof operationalLocationSchema>;
export type OperationalSelectorContext = z.infer<typeof operationalContextSchema>;

const catalogItemSchema = z.object({
  id: uuidSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  productName: z.string().min(1),
});

export const catalogSearchResponseSchema = z.object({ items: z.array(catalogItemSchema) });

export type CatalogSelectorItem = z.infer<typeof catalogItemSchema>;

function invalidResponse(): Error {
  return new Error("Respuesta inválida del servidor.");
}

export function parseOperationalContext(data: unknown): OperationalSelectorContext {
  const parsed = operationalContextSchema.safeParse(data);
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
}

export function parseCatalogSearchResults(data: unknown): CatalogSelectorItem[] {
  const parsed = catalogSearchResponseSchema.safeParse(data);
  if (!parsed.success) throw invalidResponse();
  return parsed.data.items;
}

export function locationOptionLabel(location: { name: string; code: string }): string {
  return `${location.name} (${location.code})`;
}

export function variantDisplayName(option: { sku: string; name: string; productName: string }): string {
  return `${option.sku} — ${option.productName} (${option.name})`;
}

export function isVariantSelectionStale(query: string, selectedLabel: string): boolean {
  return selectedLabel.length > 0 && query !== selectedLabel;
}

export function validateReceiptSelection(input: {
  locationId: string;
  variantId: string;
  query: string;
  selectedLabel: string;
  quantity: string;
  reason: string;
}): string | null {
  if (!input.locationId) return "Seleccioná una ubicación de la lista.";
  if (!input.variantId || isVariantSelectionStale(input.query, input.selectedLabel)) {
    return "Buscá y seleccioná una variante del catálogo.";
  }
  if (!input.quantity || !input.reason) return "Completá ubicación, variante, cantidad y motivo.";
  return null;
}

export function toContextErrorMessage(reason: unknown): string {
  if (reason instanceof z.ZodError) return "Respuesta inválida del servidor.";
  if (reason instanceof SyntaxError) return "Respuesta inválida del servidor.";
  if (reason instanceof Error && reason.message) return reason.message;
  return "No se pudieron cargar las ubicaciones.";
}

export function locationFilterDisplay(
  locationId: string,
  locations: OperationalSelectorLocation[],
): string | null {
  if (!locationId) return null;
  const found = locations.find((location) => location.id === locationId);
  return found ? locationOptionLabel(found) : "Filtro por ubicación aplicado";
}

export function selectorErrorMessage(status: number): string {
  if (status === 401) return "Tu sesión expiró. Volvé a iniciar sesión.";
  if (status === 403) {
    return "No tenés permiso para ver ubicaciones por nombre. Se mantienen los filtros aplicados.";
  }
  return "No se pudieron cargar las opciones. Reintentá.";
}

export function LocationSelect({
  id,
  label,
  locations,
  value,
  onChange,
  disabled = false,
  loading = false,
  placeholder = "Seleccionar ubicación…",
  includeAllOption = false,
  fieldClassName,
  selectClassName,
}: {
  id: string;
  label: string;
  locations: OperationalSelectorLocation[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  includeAllOption?: boolean;
  fieldClassName?: string;
  selectClassName?: string;
}) {
  const known = locations.some((location) => location.id === value);
  return (
    <div className={fieldClassName}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        aria-label={label}
        value={value}
        disabled={disabled || loading}
        className={selectClassName}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeAllOption ? (
          <option value="">Todas</option>
        ) : (
          <option value="">{loading ? "Cargando ubicaciones…" : placeholder}</option>
        )}
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {locationOptionLabel(location)}
          </option>
        ))}
        {value && !known && !loading && (
          <option value={value}>Ubicación actual (filtro aplicado)</option>
        )}
      </select>
    </div>
  );
}

function useCatalogSearch() {
  const [options, setOptions] = useState<ProductComboboxOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    requestRef.current += 1;
  }, []);

  function search(text: string, selectedLabel: string | null) {
    const trimmed = text.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setOptions([]);
    if (trimmed.length < 2 || (selectedLabel !== null && trimmed === selectedLabel)) {
      setOptions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    timerRef.current = setTimeout(() => {
      void fetch(`/api/pos/catalog?q=${encodeURIComponent(trimmed)}`)
        .then((response) => {
          if (!response.ok) throw new Error(`CATALOG_${response.status}`);
          return response.json() as Promise<unknown>;
        })
        .then((data) => {
          if (requestRef.current !== requestId) return;
          setOptions(parseCatalogSearchResults(data));
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          setOptions([]);
          setSearchError("No se pudo buscar variantes. Probá de nuevo.");
        })
        .finally(() => {
          if (requestRef.current === requestId) setSearching(false);
        });
    }, 250);
  }

  return { options, searching, searchError, search };
}

export function useVariantSelection() {
  const [query, setQueryState] = useState("");
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const { options, searching, searchError, search } = useCatalogSearch();

  function setQuery(value: string) {
    setQueryState(value);
    if (selected && isVariantSelectionStale(value, selected.label)) {
      setSelected(null);
      search(value, null);
    } else {
      search(value, selected?.label ?? null);
    }
  }

  function select(option: CatalogSelectorItem) {
    const label = variantDisplayName(option);
    setSelected({ id: option.id, label });
    setQueryState(label);
    search(label, label);
  }

  function reset() {
    setQueryState("");
    setSelected(null);
    search("", null);
  }

  return { query, setQuery, selected, select, reset, options, searching, searchError };
}

export function InventoryVariantField({
  id,
  label,
  placeholder = "Buscar por nombre o SKU…",
  query,
  options,
  searching,
  searchError,
  onQueryChange,
  onSelect,
  fieldClassName,
  inputClassName,
  listClassName,
}: {
  id: string;
  label: string;
  placeholder?: string;
  query: string;
  options: ProductComboboxOption[];
  searching: boolean;
  searchError: string | null;
  onQueryChange: (value: string) => void;
  onSelect: (option: CatalogSelectorItem) => void;
  fieldClassName?: string;
  inputClassName?: string;
  listClassName?: string;
}) {
  return (
    <div className={fieldClassName}>
      <label htmlFor={id}>{label}</label>
      <ProductCombobox
        id={id}
        label={label}
        placeholder={placeholder}
        value={query}
        options={options}
        isLoading={searching}
        inputClassName={inputClassName}
        listClassName={listClassName}
        noResultsText={searchError ?? "Sin coincidencias. Escribí al menos 2 letras."}
        onChange={onQueryChange}
        onSelect={(option) =>
          onSelect({ id: option.id, sku: option.sku, name: option.name, productName: option.productName })
        }
      />
    </div>
  );
}

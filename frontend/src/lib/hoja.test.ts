import { describe, it, expect } from "vitest";
import { crearXlsx, leerXlsx } from "./xlsx";
import { aNumero, parseCsv, revisarHoja, PLANTILLA } from "./hoja";

describe("xlsx", () => {
  it("lo que se exporta se vuelve a leer igual (texto con acentos y símbolos, y números)", async () => {
    const filas = [...PLANTILLA, ["Café & <té> \"especial\"", "CAF-1", "Bebidas", "", 3.25, 4.5, 0, 2]];
    const blob = crearXlsx(filas, "Inventario");
    expect(blob.type).toContain("spreadsheetml");
    const leidas = await leerXlsx(await blob.arrayBuffer());
    expect(leidas[0]).toEqual(PLANTILLA[0]);
    expect(leidas[4]).toEqual(["Café & <té> \"especial\"", "CAF-1", "Bebidas", undefined, 3.25, 4.5, 0, 2]);
  });

  it("un archivo que no es Excel da un error entendible", async () => {
    await expect(leerXlsx(new TextEncoder().encode("hola").buffer as ArrayBuffer)).rejects.toThrow(/no es un Excel/);
  });
});

describe("parseCsv", () => {
  it("detecta ';' (Excel en español), respeta comillas y quita el BOM", () => {
    expect(parseCsv('﻿Nombre;Precio\r\n"Arroz; 5 lb";"3,50"\nLeche;1.35\n')).toEqual([
      ["Nombre", "Precio"],
      ["Arroz; 5 lb", "3,50"],
      ["Leche", "1.35"],
    ]);
  });

  it("acepta coma como separador y comillas dobles escapadas", () => {
    expect(parseCsv('a,b\n"di ""hola""",2')).toEqual([["a", "b"], ['di "hola"', "2"]]);
  });
});

describe("aNumero", () => {
  it("entiende formatos de precio comunes", () => {
    expect(aNumero("$3.50")).toBe(3.5);
    expect(aNumero("3,50")).toBe(3.5);
    expect(aNumero("1,250")).toBe(1250);
    expect(aNumero("1.250,75")).toBe(1250.75);
    expect(aNumero("0,750")).toBe(0.75);
    expect(aNumero(4)).toBe(4);
    expect(aNumero("abc")).toBeUndefined();
  });
});

describe("revisarHoja", () => {
  it("reconoce encabezados alternativos sin importar tildes ni orden", () => {
    const r = revisarHoja([
      ["Código", "Producto", "Costo", "Precio", "Existencias", "Mínimo", "Rubro"],
      ["A-1", "Jabón", "0,45", "0,75", "30", "5", "Limpieza"],
    ]);
    expect(r.columnasFaltantes).toEqual([]);
    expect(r.filas[0].datos).toEqual({
      nombre: "Jabón",
      sku: "A-1",
      categoria: "Limpieza",
      proveedor: undefined,
      precioCompra: 0.45,
      precioVenta: 0.75,
      stock: 30,
      stockMinimo: 5,
    });
  });

  it("marca las filas con errores con su número de fila y salta las vacías", () => {
    const r = revisarHoja([
      ["Nombre", "Precio compra", "Precio venta", "Stock", "SKU"],
      ["Arroz", 2, 3, 10, "X1"],
      [],
      ["", 1, 2, 1, ""],
      ["Leche", 1, "gratis", 1, ""],
      ["Aceite", 1, 2, 1.5, ""],
      ["Arroz 2", 2, 3, 1, "x1"],
    ]);
    expect(r.filas.map((f) => [f.fila, f.error ?? "ok"])).toEqual([
      [2, "ok"],
      [4, "Falta el nombre"],
      [5, "Precio de venta inválido"],
      [6, "El stock debe ser un entero ≥ 0"],
      [7, "SKU repetido (ya está en la fila 2)"],
    ]);
  });

  it("acepta 'Precio costo' / 'Precio de costo' como precio de compra", () => {
    for (const titulo of ["Precio costo", "Precio de costo"]) {
      const r = revisarHoja([["Producto", titulo, "Precio de venta"], ["Arroz 1 lb", 0.5, 0.75]]);
      expect(r.columnasFaltantes).toEqual([]);
      expect(r.filas[0].datos).toMatchObject({ nombre: "Arroz 1 lb", precioCompra: 0.5, precioVenta: 0.75 });
    }
  });

  it("avisa qué columnas obligatorias faltan", () => {
    expect(revisarHoja([["Nombre", "Stock"], ["Arroz", 3]]).columnasFaltantes).toEqual(["Precio compra", "Precio venta"]);
  });
});

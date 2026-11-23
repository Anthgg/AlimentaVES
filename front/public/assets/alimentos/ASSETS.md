# Assets de alimentos

Fecha de incorporación: 2026-11-23.
Destino: `front/public/assets/alimentos/`.

## Uso y procedencia

- Los ocho PNG principales provienen de la carpeta del proyecto en [Google Drive](https://drive.google.com/drive/folders/1rHCyzlhaPop9bavV-6HsVq0WXHyYHpZV). El README de esa carpeta los describe como ilustraciones decorativas/placeholders, no como fotografías verificadas de donaciones o comedores. Son assets proporcionados por el usuario; la carpeta no incluye una licencia independiente.
- Se incorporaron cuatro ingredientes transparentes desde [cosmintrica/culinary-assets, v0.5.0](https://github.com/cosmintrica/culinary-assets/tree/v0.5.0). `LICENSE-ASSETS` dedica los derechos que el contribuidor pueda tener bajo [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/); atribución bienvenida, no obligatoria. El aviso limita esa dedicación a derechos que el contribuidor pueda tener, no garantiza derechos de terceros, no otorga derechos de marca y ofrece los assets sin garantía.
- Las dos fotografías son de Pexels y se descargaron el 2026-11-23 a 1600 px de ancho. La [licencia oficial de Pexels](https://www.pexels.com/license/) permite usar fotos en sitios y aplicaciones sin atribución obligatoria; prohíbe sugerir respaldo de marcas/personas, vender copias sin modificar o redistribuirlas como catálogo/servicio de stock. Se incluyen créditos por procedencia.
- Los nombres `illustrative-…` y este manifiesto identifican las fotos como ilustrativas. La interfaz debe mostrar «Imagen ilustrativa» y nunca presentarlas como foto de una donación o comedor real. Si la API proporciona una foto aprobada, priorizarla. La revisión visual encontró alimentos y utensilios sin personas identificables ni marcas/logos evidentes.

## Archivos

| Archivo | Origen / atribución | Dimensiones | Formato | Transparencia | Transformación |
|---|---|---:|---|---|---|
| `caja-solidaria.png` | Drive: `01_Caja_Solidaria.png` | 1536 × 1024 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `verduras-frescas.png` | Drive: `02_Verduras_Frescas.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `canasta-frutas.png` | Drive: `03_Canasta_Frutas.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `arroz.png` | Drive: `04_Arroz.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `despensa-legumbres.png` | Drive: `05_Despensa_y_Legumbres.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `panaderia.png` | Drive: `06_Panaderia.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `olla-comunitaria.png` | Drive: `07_Olla_Comunitaria.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `menu-preparado.png` | Drive: `08_Menu_Preparado.png` | 1254 × 1254 | PNG | Sí (canal alfa) | Renombrado; recompresión lossless del IDAT; sin cambios de píxeles, tamaño o color. |
| `ingredient-tomato.png` | [Culinary Assets `tomato.png`](https://github.com/cosmintrica/culinary-assets/blob/v0.5.0/assets/png/tomato.png), cosmintrica; CC0 1.0 | 512 × 512 | PNG | Sí (canal alfa) | Nombre estable; original sin reescalar ni recomprimir. |
| `ingredient-carrot.png` | [Culinary Assets `carrot.png`](https://github.com/cosmintrica/culinary-assets/blob/v0.5.0/assets/png/carrot.png), cosmintrica; CC0 1.0 | 512 × 512 | PNG | Sí (canal alfa) | Nombre estable; original sin reescalar ni recomprimir. |
| `ingredient-rice-pile.png` | [Culinary Assets `rice_pile.png`](https://github.com/cosmintrica/culinary-assets/blob/v0.5.0/assets/png/rice_pile.png), cosmintrica; CC0 1.0 | 512 × 512 | PNG | Sí (canal alfa) | Nombre estable; original sin reescalar ni recomprimir. |
| `ingredient-green-beans.png` | [Culinary Assets `green_beans.png`](https://github.com/cosmintrica/culinary-assets/blob/v0.5.0/assets/png/green_beans.png), cosmintrica; CC0 1.0 | 512 × 512 | PNG | Sí (canal alfa) | Nombre estable; original sin reescalar ni recomprimir. |
| `illustrative-food-bread-vegetables-matvei.jpg` | [Matvei, Pexels photo 36739071](https://www.pexels.com/photo/rustic-bread-and-vegetables-on-wooden-table-36739071/); Pexels License | 1600 × 1068 | JPEG | No aplica | Descarga JPEG servida a 1600 px; sin recorte ni reencodificación local. Etiquetar «Imagen ilustrativa». |
| `illustrative-food-vegetable-soup-phat-nguy.jpg` | [Phat Nguy, Pexels photo 17559227](https://www.pexels.com/photo/a-bowl-of-soup-with-bread-and-vegetables-on-a-white-table-17559227/); Pexels License | 1600 × 1280 | JPEG | No aplica | Descarga JPEG servida a 1600 px; sin recorte ni reencodificación local. Etiquetar «Imagen ilustrativa». |

## Optimización verificada

Los ocho PNG de Drive se recomprimieron con zlib nivel 9. Se comparó el flujo de píxeles descomprimido antes/después y el SHA-256 fue idéntico para cada archivo; se conservaron los chunks no-IDAT y el canal alfa. El total bajó 369 444 bytes (≈361 KiB), sin pérdida visual. Las cuatro imágenes CC0 se conservaron byte por byte: la recompresión propuesta aumentaba sus tamaños.

El directorio contiene solamente ilustraciones y fotografías de alimentos genéricas. No contiene información personal de beneficiarios ni responsables.

const foodAssetRoot = '/assets/alimentos/'

export function FoodVisual({ file, alt, className = '', caption = 'Ilustración decorativa · no representa una donación ni un comedor real.' }: {
  file: string
  alt: string
  className?: string
  caption?: string
}) {
  return <figure className={`np-food-visual ${className}`}>
    <img src={`${foodAssetRoot}${file}`} alt={alt} loading="lazy" decoding="async" />
    <figcaption>{caption}</figcaption>
  </figure>
}

export function FoodCategoryGuide() {
  const categories = [
    { file: 'verduras-frescas.png', alt: 'Ilustración de verduras frescas', label: 'Verduras' },
    { file: 'arroz.png', alt: 'Ilustración de arroz', label: 'Granos y cereales' },
    { file: 'despensa-legumbres.png', alt: 'Ilustración decorativa de una despensa con legumbres', label: 'Legumbres' },
    { file: 'panaderia.png', alt: 'Ilustración de productos de panadería', label: 'Panadería' },
    { file: 'menu-preparado.png', alt: 'Ilustración de un menú preparado', label: 'Preparaciones' },
  ]
  return <section className="np-food-category-guide" aria-labelledby="food-category-title">
    <div className="np-food-category-heading"><div><p className="np-eyebrow"><span />REFERENCIAS VISUALES</p><h2 id="food-category-title">Categorías de alimentos</h2></div><p>Ilustraciones de apoyo. No indican disponibilidad ni representan donaciones registradas.</p></div>
    <ul>{categories.map((item) => <li key={item.file}><img src={`${foodAssetRoot}${item.file}`} alt={item.alt} loading="lazy" decoding="async" /><span>{item.label}</span></li>)}</ul>
  </section>
}

export function IllustrativeFoodPhotoShelf() {
  const photos = [
    { file: 'illustrative-food-bread-vegetables-matvei.jpg', alt: 'Pan y verduras sobre una mesa', credit: 'Foto: Matvei / Pexels' },
    { file: 'illustrative-food-vegetable-soup-phat-nguy.jpg', alt: 'Sopa de verduras servida con pan', credit: 'Foto: Phat Nguy / Pexels' },
  ]
  return <section className="np-photo-inspiration" aria-labelledby="photo-inspiration-title">
    <div className="np-photo-inspiration-heading"><p className="np-eyebrow"><span />REFERENCIAS VISUALES</p><h2 id="photo-inspiration-title">Alimentos que pueden compartirse.</h2><p>Estas fotografías son editoriales y no representan donaciones ni comedores registrados en AlimentaVES.</p></div>
    <div className="np-photo-inspiration-grid">{photos.map((photo) => <figure key={photo.file}><img src={`${foodAssetRoot}${photo.file}`} alt={photo.alt} loading="lazy" decoding="async" /><figcaption><span>Imagen ilustrativa · no corresponde a un lote real.</span><cite>{photo.credit}</cite></figcaption></figure>)}</div>
  </section>
}

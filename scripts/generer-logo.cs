// Génère les visuels de marque SKYS ERP à partir du logo JPEG :
//  - logo-fond-clair.png : logo sur fond transparent, optimisé pour fond clair
//  - logo-fond-sombre.png : variante pour fond sombre (barre latérale)
//  - logo192.png / logo512.png : icônes PWA (fond transparent)
//  - favicon.ico : icône d'onglet
//  - logo-icone.png : graphique seul (barres + flèche), sans le texte SKYS ERP
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

class GenererLogo
{
    static string RacineAssets;
    static string RacinePublic;

    static void Main(string[] args)
    {
        RacineAssets = args.Length > 0 ? args[0] : "src/Assets";
        RacinePublic = args.Length > 1 ? args[1] : "public";
        // Logo source officiel : hexagone "T" orange + texte SKYS ERP / SOLUTION.
        string source = Path.Combine(RacineAssets, "logo-hexagone.jpg");
        if (!File.Exists(source))
        {
            // Repli sur l'ancien logo si le nouveau n'est pas present.
            source = Path.Combine(RacineAssets, "logo.png.jpeg");
        }

        using (var original = new Bitmap(source))
        {
            // 1. Rendre le fond noir transparent (le graphique est bleu/argent).
            using (var transparent = RendreNoirTransparent(original))
            {
                // 2. Recadrer serre sur le contenu reel (retire les grandes
                //    marges vides du JPEG, sinon le logo parait minuscule).
                using (var recadre = RecadrerContenu(transparent))
                {
                    // Variante pour fond SOMBRE (barre laterale #0f172a) :
                    // le texte grisatre est force en blanc franc pour bien
                    // contraster sur le fond fonce.
                    using (var eclairci = EclaircirTextePourFondSombre(recadre))
                    {
                        eclairci.Save(Path.Combine(RacineAssets, "logo-fond-sombre.png"), ImageFormat.Png);
                    }

                    // Variante pour fond CLAIR (page de connexion, documents) :
                    // le texte blanc du logo est assombri pour rester lisible.
                    using (var assombri = AssombrirPourFondClair(recadre))
                    {
                        assombri.Save(Path.Combine(RacineAssets, "logo-fond-transparent.png"), ImageFormat.Png);
                    }

                    // 3. Icones PWA et favicon.
                    SauverRedimensionne(recadre, Path.Combine(RacinePublic, "logo192.png"), 192);
                    SauverRedimensionne(recadre, Path.Combine(RacinePublic, "logo512.png"), 512);
                    SauverIco(recadre, Path.Combine(RacinePublic, "favicon.ico"), 64);
                    SauverRedimensionne(recadre, Path.Combine(RacineAssets, "logo-transparent.png"), 512);
                }
            }
        }

        Console.WriteLine("LOGOS_GENERES");
    }

    // Remplace les pixels sombres quasi-noirs par du transparent,
    // en conservant les bords. Le graphique (bleu/argent) est préservé.
    static Bitmap RendreNoirTransparent(Bitmap src)
    {
        var dst = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
        for (int y = 0; y < src.Height; y++)
        {
            for (int x = 0; x < src.Width; x++)
            {
                Color c = src.GetPixel(x, y);
                // Luminance percue : le fond noir bruité (compression JPEG)
                // monte jusqu'à ~50 ; le graphique bleu/argent reste bien au-dessus.
                int lum = (int)(0.299 * c.R + 0.587 * c.G + 0.114 * c.B);
                int alpha;
                if (lum <= 50) alpha = 0;                    // fond noir -> transparent
                else if (lum <= 110) alpha = (lum - 50) * 255 / 60; // bord dégradé doux
                else alpha = 255;
                dst.SetPixel(x, y, Color.FromArgb(alpha, c.R, c.G, c.B));
            }
        }
        return dst;
    }

    // Détoure la boîte englobant les pixels non transparents.
    static Bitmap RecadrerContenu(Bitmap src)
    {
        int minX = src.Width, minY = src.Height, maxX = -1, maxY = -1;
        for (int y = 0; y < src.Height; y++)
        {
            for (int x = 0; x < src.Width; x++)
            {
                if (src.GetPixel(x, y).A > 12)
                {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) return src;
        var rect = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
        var dst = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(dst))
        {
            g.DrawImage(src, new Rectangle(0, 0, rect.Width, rect.Height), rect, GraphicsUnit.Pixel);
        }
        return dst;
    }

    // Force le texte clair (blanc grisatre) en blanc franc pour la barre
    // laterale sombre. Les couleurs vives (orange, bleu) sont preservees.
    static Bitmap EclaircirTextePourFondSombre(Bitmap src)
    {
        var dst = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
        const int seuil = 150;   // au-dela : consideré comme du texte clair
        for (int y = 0; y < src.Height; y++)
        {
            for (int x = 0; x < src.Width; x++)
            {
                Color c = src.GetPixel(x, y);
                if (c.A == 0) { dst.SetPixel(x, y, c); continue; }

                int lum = (int)(0.299 * c.R + 0.587 * c.G + 0.114 * c.B);
                if (lum < seuil) { dst.SetPixel(x, y, c); continue; }

                // Progression douce vers le blanc pur.
                double t = (lum - seuil) / (double)Math.Max(1, 255 - seuil);
                int nr = (int)(c.R * (1 - t) + 255 * t);
                int ng = (int)(c.G * (1 - t) + 255 * t);
                int nb = (int)(c.B * (1 - t) + 255 * t);
                dst.SetPixel(x, y, Color.FromArgb(c.A, nr, ng, nb));
            }
        }
        return dst;
    }

    // Assombrit les pixels tres clairs du logo pour qu'il reste lisible sur
    // un fond CLAIR (page de connexion, documents imprimes). Le texte blanc
    // du logo devient gris fonce/bleu nuit ; les couleurs vives (orange du
    // monogramme, bleu de l'hexagone) sont preservees.
    static Bitmap AssombrirPourFondClair(Bitmap src)
    {
        var dst = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
        const int seuil = 170;   // au-dela : consideré comme "blanc" a assombrir
        for (int y = 0; y < src.Height; y++)
        {
            for (int x = 0; x < src.Width; x++)
            {
                Color c = src.GetPixel(x, y);
                if (c.A == 0) { dst.SetPixel(x, y, c); continue; }

                int lum = (int)(0.299 * c.R + 0.587 * c.G + 0.114 * c.B);
                if (lum < seuil)
                {
                    // Couleur deja suffisamment foncee (orange, bleu) : inchangee.
                    dst.SetPixel(x, y, c);
                    continue;
                }

                // Blanc/gris tres clair -> bleu nuit, en conservant la teinte.
                double t = (lum - seuil) / (double)Math.Max(1, 255 - seuil);
                int nr = (int)(c.R * (1 - t) + 15 * t);
                int ng = (int)(c.G * (1 - t) + 23 * t);
                int nb = (int)(c.B * (1 - t) + 42 * t);
                dst.SetPixel(x, y, Color.FromArgb(c.A, nr, ng, nb));
            }
        }
        return dst;
    }

    static void SauverRedimensionne(Bitmap src, string chemin, int taille)
    {
        using (var canvas = new Bitmap(taille, taille, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(canvas))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.Clear(Color.Transparent);

            double ratio = Math.Min((double)taille / src.Width, (double)taille / src.Height) * 0.92;
            int w = (int)(src.Width * ratio);
            int h = (int)(src.Height * ratio);
            int ox = (taille - w) / 2;
            int oy = (taille - h) / 2;
            g.DrawImage(src, new Rectangle(ox, oy, w, h));
            canvas.Save(chemin, ImageFormat.Png);
        }
    }

    // Crée un .ico multi-résolution (16/32/48/64) à partir de l'image.
    static void SauverIco(Bitmap src, string chemin, int tailleBase)
    {
        int[] tailles = new int[] { 16, 32, 48, 64 };
        using (var fs = new FileStream(chemin, FileMode.Create))
        using (var bw = new BinaryWriter(fs))
        {
            bw.Write((short)0); bw.Write((short)1); bw.Write((short)tailles.Length);
            long offset = 6 + 16L * tailles.Length;
            var pngs = new byte[tailles.Length][];
            for (int i = 0; i < tailles.Length; i++)
            {
                using (var mem = new MemoryStream())
                {
                    using (var canvas = new Bitmap(tailles[i], tailles[i], PixelFormat.Format32bppArgb))
                    using (var g = Graphics.FromImage(canvas))
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.SmoothingMode = SmoothingMode.HighQuality;
                        g.Clear(Color.Transparent);
                        double ratio = Math.Min((double)tailles[i] / src.Width, (double)tailles[i] / src.Height) * 0.94;
                        int w = Math.Max(1, (int)(src.Width * ratio));
                        int h = Math.Max(1, (int)(src.Height * ratio));
                        g.DrawImage(src, new Rectangle((tailles[i] - w) / 2, (tailles[i] - h) / 2, w, h));
                        canvas.Save(mem, ImageFormat.Png);
                    }
                    pngs[i] = mem.ToArray();
                }
                bw.Write((byte)(tailles[i] >= 256 ? 0 : tailles[i]));
                bw.Write((byte)(tailles[i] >= 256 ? 0 : tailles[i]));
                bw.Write((byte)0); bw.Write((byte)0);
                bw.Write((short)1); bw.Write((short)32);
                bw.Write((int)pngs[i].Length);
                bw.Write((int)offset);
                offset += pngs[i].Length;
            }
            foreach (var png in pngs) bw.Write(png);
        }
    }
}

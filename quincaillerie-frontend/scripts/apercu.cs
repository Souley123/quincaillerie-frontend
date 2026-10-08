// Génère les aperçus de rendu du logo SKYS ERP Solution.
//
// Le logo source est un JPEG à fond NOIR opaque : le dessiner tel quel sur un
// canevas blanc recouvrirait tout de noir. On compose donc à partir des
// variantes PNG déjà détourées (fond transparent) produites par
// generer-logo.cs :
//   - apercu-blanc.png  : logo assombri (lisible sur fond clair)
//   - apercu-sombre.png : logo éclairci (lisible sur fond sombre #0f172a)
using System;
using System.Drawing;
using System.Drawing.Imaging;

class Apercu
{
    static void Main(string[] args)
    {
        // args[0] : logo pour fond clair (ex. logo-fond-transparent.png)
        // args[1] : logo pour fond sombre (ex. logo-fond-sombre.png)
        using (var clair = new Bitmap(args[0]))
            Composer(clair, Color.White, "apercu-blanc.png");

        using (var sombre = new Bitmap(args[1]))
            Composer(sombre, Color.FromArgb(15, 23, 42), "apercu-sombre.png");

        Console.WriteLine("APERCUS_GENERES");
    }

    static void Composer(Bitmap logo, Color fond, string sortie)
    {
        // On agrandit pour bien voir le rendu a l'echelle de l'interface.
        int cible = 240;
        double ratio = Math.Min((double)cible / logo.Width, (double)cible / logo.Height);
        int w = (int)(logo.Width * ratio);
        int h = (int)(logo.Height * ratio);
        int marge = 30;
        using (var canvas = new Bitmap(w + marge * 2, h + marge * 2, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(canvas))
        {
            g.Clear(fond);
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.DrawImage(logo, new Rectangle(marge, marge, w, h));
            canvas.Save(sortie, ImageFormat.Png);
        }
    }
}

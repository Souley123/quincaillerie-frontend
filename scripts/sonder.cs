using System;
using System.Drawing;

class Sonder
{
    static void Main(string[] args)
    {
        using (var b = new Bitmap(args[0]))
        {
            Console.WriteLine("Image : " + b.Width + "x" + b.Height);
            int[,] pts = new int[,] {
                {0,0}, {b.Width-1,0}, {0,b.Height-1}, {b.Width-1,b.Height-1},
                {b.Width/2, 5}, {5, b.Height/2}, {b.Width/2, b.Height/2}
            };
            for (int i = 0; i < pts.GetLength(0); i++)
            {
                Color c = b.GetPixel(pts[i,0], pts[i,1]);
                Console.WriteLine("(" + pts[i,0] + "," + pts[i,1] + ") R=" + c.R + " G=" + c.G + " B=" + c.B);
            }

            int maxBord = 0;
            for (int x = 0; x < b.Width; x++)
                foreach (int y in new int[] { 0, 1, b.Height-2, b.Height-1 })
                {
                    Color c = b.GetPixel(x, y);
                    int lum = (int)(0.299*c.R + 0.587*c.G + 0.114*c.B);
                    if (lum > maxBord) maxBord = lum;
                }
            Console.WriteLine("Luminance max bordure (fond) : " + maxBord);

            // Boite du contenu (non quasi-noir)
            int minX = b.Width, minY = b.Height, maxX = -1, maxY = -1;
            for (int y = 0; y < b.Height; y++)
                for (int x = 0; x < b.Width; x++)
                {
                    Color c = b.GetPixel(x, y);
                    int lum = (int)(0.299*c.R + 0.587*c.G + 0.114*c.B);
                    if (lum > 45)
                    {
                        if (x < minX) minX = x; if (y < minY) minY = y;
                        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                    }
                }
            Console.WriteLine("Contenu : x[" + minX + ".." + maxX + "] y[" + minY + ".." + maxY + "]");
        }
    }
}

from manim import *

class SimplePEMDAS(Scene):
    def construct(self):
        # Title
        title = Text("Order of Operations (PEMDAS)")
        title.to_edge(UP)
        self.play(Write(title))
        
        # Initial equation
        eq1 = MathTex(r"8 \div 2(2 + 2)")
        self.play(Write(eq1))
        
        # Step 1: Parentheses
        eq2 = MathTex(r"8 \div 2 \times 4")
        self.play(Transform(eq1, eq2))
        
        # Step 2: Division
        eq3 = MathTex(r"4 \times 4")
        self.play(Transform(eq1, eq3))
        
        # Final result
        eq4 = MathTex(r"16")
        self.play(Transform(eq1, eq4))
        
        # Final box
        box = SurroundingRectangle(eq1)
        self.play(Create(box))
        
        self.wait(2)

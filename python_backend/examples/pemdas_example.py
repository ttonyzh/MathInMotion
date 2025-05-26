from manim import *

class PEMDASVisualization(Scene):
    def construct(self):
        # Title
        title = Text("Order of Operations (PEMDAS)", font_size=42)
        title.to_edge(UP)
        self.play(Write(title))
        self.wait(1)
        
        # Initial equation
        equation = MathTex(r"8 \div 2(2 + 2)")
        equation.scale(1.5)
        self.play(Write(equation))
        self.wait(1)
        
        # Step 1: Highlight parentheses
        self.play(equation.animate.set_color(WHITE))
        parentheses = MathTex(r"8 \div 2(\color{yellow}{2 + 2})")
        parentheses.scale(1.5)
        self.play(Transform(equation, parentheses))
        self.wait(1)
        
        # Step 2: Calculate inside parentheses
        step1_text = Text("Step 1: Evaluate inside parentheses first", font_size=32)
        step1_text.next_to(equation, DOWN, buff=1)
        self.play(Write(step1_text))
        
        parentheses_calc = MathTex(r"2 + 2 = 4")
        parentheses_calc.scale(1.2)
        parentheses_calc.next_to(step1_text, DOWN, buff=0.5)
        parentheses_calc.set_color(YELLOW)
        self.play(Write(parentheses_calc))
        self.wait(1)
        
        # Step 3: Update equation
        updated_eq = MathTex(r"8 \div 2 \times 4")
        updated_eq.scale(1.5)
        self.play(
            Transform(equation, updated_eq),
            FadeOut(parentheses_calc),
            FadeOut(step1_text)
        )
        self.wait(1)
        
        # Step 4: Highlight division (left to right)
        step2_text = Text("Step 2: Perform multiplication and division from left to right", font_size=32)
        step2_text.next_to(equation, DOWN, buff=1)
        self.play(Write(step2_text))
        
        division_highlight = MathTex(r"\color{green}{8 \div 2} \times 4")
        division_highlight.scale(1.5)
        self.play(Transform(equation, division_highlight))
        self.wait(1)
        
        # Step 5: Calculate division
        division_calc = MathTex(r"8 \div 2 = 4")
        division_calc.scale(1.2)
        division_calc.next_to(step2_text, DOWN, buff=0.5)
        division_calc.set_color(GREEN)
        self.play(Write(division_calc))
        self.wait(1)
        
        # Step 6: Update equation after division
        after_division = MathTex(r"4 \times 4")
        after_division.scale(1.5)
        self.play(Transform(equation, after_division))
        self.wait(1)
        
        # Step 7: Calculate multiplication
        mult_highlight = MathTex(r"\color{blue}{4 \times 4}")
        mult_highlight.scale(1.5)
        self.play(Transform(equation, mult_highlight))
        
        mult_calc = MathTex(r"4 \times 4 = 16")
        mult_calc.scale(1.2)
        mult_calc.next_to(division_calc, DOWN, buff=0.5)
        mult_calc.set_color(BLUE)
        self.play(Write(mult_calc))
        self.wait(1)
        
        # Final answer
        self.play(
            FadeOut(step2_text),
            FadeOut(division_calc),
            FadeOut(mult_calc)
        )
        
        final_eq = MathTex(r"8 \div 2(2 + 2) = 16")
        final_eq.scale(1.5)
        self.play(Transform(equation, final_eq))
        
        box = SurroundingRectangle(final_eq, color=YELLOW, buff=0.5)
        final_text = Text("Final Answer: 16", font_size=36)
        final_text.next_to(box, DOWN, buff=0.5)
        final_text.set_color(YELLOW)
        
        self.play(
            Create(box),
            Write(final_text)
        )
        self.wait(2)
        
        # PEMDAS reminder
        pemdas = VGroup(
            Text("P - Parentheses", font_size=28),
            Text("E - Exponents", font_size=28),
            Text("M/D - Multiplication/Division (left to right)", font_size=28),
            Text("A/S - Addition/Subtraction (left to right)", font_size=28)
        ).arrange(DOWN, aligned_edge=LEFT)
        pemdas.to_edge(LEFT).shift(DOWN)
        
        self.play(
            FadeOut(equation),
            FadeOut(box),
            FadeOut(final_text),
            FadeOut(title)
        )
        
        pemdas_title = Text("PEMDAS: Order of Operations", font_size=42)
        pemdas_title.to_edge(UP)
        
        self.play(
            Write(pemdas_title),
            Write(pemdas)
        )
        self.wait(3)

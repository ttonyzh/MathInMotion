from manim import *
import numpy as np

class ComplexTransformation(Scene):
    def construct(self):
        # Create a number plane
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-4, 4, 1],
            background_line_style={
                "stroke_opacity": 0.6
            }
        )
        
        # Create function text
        func_text = MathTex("f(z) = z^2")
        func_text.to_corner(UL)
        
        # Create some sample points
        dots = VGroup(*[
            Dot([x, 0, 0], color=BLUE)
            for x in np.linspace(-2, 2, 10)
        ])
        
        # Create paths for animation
        paths = VGroup(*[
            ParametricFunction(
                lambda t: [x * np.cos(t), x * np.sin(t), 0],
                t_range=[0, TAU],
                color=YELLOW,
                stroke_opacity=0.3
            )
            for x in np.linspace(0.5, 2, 4)
        ])
        
        # Show the initial setup
        self.play(Create(plane))
        self.play(Write(func_text))
        self.play(Create(dots))
        self.play(Create(paths))
        
        # Transform z -> z^2
        def complex_transform(point):
            x, y = point[:2]
            z = complex(x, y)
            z_squared = z * z
            return [z_squared.real, z_squared.imag, 0]
        
        # Animate the transformation
        self.play(
            *[dot.animate.move_to(complex_transform(dot.get_center()))
              for dot in dots],
            run_time=2
        )
        
        self.wait()

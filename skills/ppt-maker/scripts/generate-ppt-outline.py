#!/usr/bin/env python3
"""
PPT Outline Generator
Creates a structured outline for PowerPoint presentations from a topic.
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Dict, List, Any


class PPTOutlineGenerator:
    """Generate PowerPoint presentation outlines."""
    
    TEMPLATES = {
        "educational": {
            "name": "Educational Presentation",
            "slides": [
                "Title Slide",
                "Learning Objectives",
                "Introduction/Background",
                "Key Concept 1",
                "Key Concept 2", 
                "Key Concept 3",
                "Examples/Case Studies",
                "Practice/Application",
                "Summary/Review",
                "Q&A/Next Steps"
            ],
            "audience": ["students", "teachers", "general public"],
            "style": "clear, visual, engaging"
        },
        "business": {
            "name": "Business Presentation",
            "slides": [
                "Title Slide",
                "Agenda",
                "Executive Summary",
                "Problem Statement",
                "Market Analysis",
                "Solution/Proposal",
                "Implementation Plan",
                "Financials/Budget",
                "Risks & Mitigation",
                "Conclusion & Call to Action",
                "Q&A"
            ],
            "audience": ["executives", "clients", "team members"],
            "style": "professional, data-driven, concise"
        },
        "technical": {
            "name": "Technical Presentation",
            "slides": [
                "Title Slide",
                "Abstract",
                "Introduction & Motivation",
                "Related Work",
                "Methodology/Approach",
                "Implementation Details",
                "Results & Analysis",
                "Discussion",
                "Limitations & Future Work",
                "Conclusion",
                "References",
                "Q&A"
            ],
            "audience": ["engineers", "researchers", "developers"],
            "style": "detailed, evidence-based, logical"
        },
        "simple": {
            "name": "Simple Presentation",
            "slides": [
                "Title Slide",
                "What We'll Cover",
                "Main Point 1",
                "Main Point 2",
                "Main Point 3",
                "Summary",
                "Thank You"
            ],
            "audience": ["general", "mixed", "beginners"],
            "style": "simple, clear, visual"
        }
    }
    
    def __init__(self):
        self.templates = self.TEMPLATES
    
    def generate_outline(
        self,
        topic: str,
        template_type: str = "simple",
        duration_minutes: int = 10,
        audience: str = "general",
        custom_slides: List[str] = None
    ) -> Dict[str, Any]:
        """Generate a presentation outline."""
        
        if template_type not in self.templates:
            print(f"Warning: Template '{template_type}' not found. Using 'simple'.")
            template_type = "simple"
        
        template = self.templates[template_type]
        
        # Calculate slides based on duration (approx 1-2 minutes per slide)
        target_slides = max(5, min(20, duration_minutes))
        
        # Adjust slide count if needed
        slide_structure = template["slides"]
        if len(slide_structure) > target_slides:
            # Keep first, last, and key middle slides
            slide_structure = (
                slide_structure[:2] + 
                slide_structure[3:5] + 
                slide_structure[-3:]
            )
        elif len(slide_structure) < target_slides:
            # Add more content slides
            middle_index = len(slide_structure) // 2
            extra_slides = [f"Additional Point {i+1}" for i in range(target_slides - len(slide_structure))]
            slide_structure = (
                slide_structure[:middle_index] + 
                extra_slides + 
                slide_structure[middle_index:]
            )
        
        # Create outline
        outline = {
            "metadata": {
                "topic": topic,
                "template": template["name"],
                "generated_date": datetime.now().isoformat(),
                "duration_minutes": duration_minutes,
                "audience": audience,
                "estimated_slides": len(slide_structure),
                "style": template["style"]
            },
            "slides": []
        }
        
        # Add slide details
        for i, slide_title in enumerate(slide_structure, 1):
            slide = {
                "slide_number": i,
                "title": slide_title,
                "content_suggestions": self._get_content_suggestions(slide_title, topic, audience),
                "visual_suggestions": self._get_visual_suggestions(slide_title, topic),
                "speaker_notes": self._get_speaker_notes(slide_title, topic, audience),
                "estimated_time_seconds": self._get_slide_time(i, len(slide_structure), duration_minutes)
            }
            outline["slides"].append(slide)
        
        return outline
    
    def _get_content_suggestions(self, slide_title: str, topic: str, audience: str) -> List[str]:
        """Get content suggestions for a slide."""
        suggestions = []
        
        if "title" in slide_title.lower():
            suggestions = [
                f"Clear, engaging title about {topic}",
                "Presenter name and affiliation",
                "Date and occasion"
            ]
        elif "agenda" in slide_title.lower() or "cover" in slide_title.lower():
            suggestions = [
                "Brief overview of presentation structure",
                "Key topics to be covered",
                "What the audience will learn",
                "Presentation roadmap"
            ]
        elif "introduction" in slide_title.lower():
            suggestions = [
                f"Context and background for {topic}",
                "Why this topic matters",
                f"Current state of {topic}",
                "Presentation objectives"
            ]
        elif "conclusion" in slide_title.lower() or "summary" in slide_title.lower():
            suggestions = [
                "Key takeaways from presentation",
                "Main points summarized",
                f"Final thoughts on {topic}",
                "Closing message"
            ]
        elif "qa" in slide_title.lower():
            suggestions = [
                "Thank audience for attention",
                "Invite questions",
                "Contact information",
                "Additional resources"
            ]
        else:
            # Generic content slide
            suggestions = [
                f"Key point about {topic}",
                "Supporting evidence or examples",
                "Relevant data or statistics",
                "Implications or applications"
            ]
        
        # Adjust for audience
        if "student" in audience.lower():
            suggestions = [s + " (simplified for students)" for s in suggestions]
        elif "executive" in audience.lower():
            suggestions = [s + " (concise for executives)" for s in suggestions]
        
        return suggestions
    
    def _get_visual_suggestions(self, slide_title: str, topic: str) -> List[str]:
        """Get visual suggestions for a slide."""
        visuals = []
        
        # Default visuals
        visuals.append("Clean, professional layout")
        
        # Topic-specific visuals
        topic_lower = topic.lower()
        if any(word in topic_lower for word in ["animal", "nature", "environment"]):
            visuals.append("High-quality nature/animal photographs")
            visuals.append("Infographics about species/habitats")
        elif any(word in topic_lower for word in ["business", "finance", "market"]):
            visuals.append("Charts and graphs for data")
            visuals.append("Professional icons and diagrams")
        elif any(word in topic_lower for word in ["technology", "software", "app"]):
            visuals.append("Screenshots or UI mockups")
            visuals.append("Flowcharts or architecture diagrams")
        elif any(word in topic_lower for word in ["education", "learning", "school"]):
            visuals.append("Engaging illustrations or icons")
            visuals.append("Step-by-step process diagrams")
        
        # Slide-specific visuals
        if "data" in slide_title.lower() or "result" in slide_title.lower():
            visuals.append("Bar chart or line graph")
            visuals.append("Data visualization")
        elif "process" in slide_title.lower() or "flow" in slide_title.lower():
            visuals.append("Flowchart or process diagram")
            visuals.append("Timeline visualization")
        elif "comparison" in slide_title.lower():
            visuals.append("Comparison table")
            visuals.append("Side-by-side images")
        
        return visuals
    
    def _get_speaker_notes(self, slide_title: str, topic: str, audience: str) -> List[str]:
        """Get speaker notes for a slide."""
        notes = []
        
        if "title" in slide_title.lower():
            notes.append("Start with a warm greeting and smile")
            notes.append("Briefly introduce yourself if needed")
            notes.append("Set positive tone for presentation")
        elif "agenda" in slide_title.lower():
            notes.append("Briefly walk through each agenda item")
            notes.append("Emphasize what audience will gain")
            notes.append("Keep this slide brief (30-60 seconds)")
        elif "conclusion" in slide_title.lower():
            notes.append("Summarize key points clearly")
            notes.append("End with strong, memorable statement")
            notes.append("Maintain eye contact")
        elif "qa" in slide_title.lower():
            notes.append("Pause before inviting questions")
            notes.append("Repeat questions for everyone to hear")
            notes.append("Have prepared answers for likely questions")
        else:
            notes.append("Explain the main point clearly")
            notes.append("Provide relevant examples or stories")
            notes.append("Check audience understanding")
        
        # Audience-specific notes
        if "student" in audience.lower():
            notes.append("Use simple, clear language")
            notes.append("Ask engaging questions")
            notes.append("Move around to maintain attention")
        elif "executive" in audience.lower():
            notes.append("Get straight to the point")
            notes.append("Focus on outcomes and ROI")
            notes.append("Be prepared for tough questions")
        
        return notes
    
    def _get_slide_time(self, slide_num: int, total_slides: int, total_minutes: int) -> int:
        """Estimate time for each slide in seconds."""
        total_seconds = total_minutes * 60
        
        # Title and closing slides get less time
        if slide_num == 1:  # Title slide
            return 30
        elif slide_num == total_slides:  # Last slide (usually Q&A)
            return 45
        
        # Middle slides get more even distribution
        middle_slides_time = (total_seconds - 75) / (total_slides - 2)
        return int(middle_slides_time)
    
    def save_outline(self, outline: Dict[str, Any], format: str = "markdown", output_file: str = None) -> str:
        """Save outline in specified format."""
        
        if format == "json":
            content = json.dumps(outline, indent=2, ensure_ascii=False)
            ext = ".json"
        elif format == "markdown":
            content = self._outline_to_markdown(outline)
            ext = ".md"
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        if not output_file:
            # Create default filename
            topic_slug = outline["metadata"]["topic"].replace(" ", "-").lower()[:50]
            output_file = f"{topic_slug}-presentation-outline{ext}"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_file
    
    def _outline_to_markdown(self, outline: Dict[str, Any]) -> str:
        """Convert outline to markdown format."""
        metadata = outline["metadata"]
        slides = outline["slides"]
        
        md_lines = []
        
        # Header
        md_lines.append(f"# Presentation Outline: {metadata['topic']}")
        md_lines.append("")
        md_lines.append("## Presentation Details")
        md_lines.append(f"- **Topic**: {metadata['topic']}")
        md_lines.append(f"- **Template**: {metadata['template']}")
        md_lines.append(f"- **Audience**: {metadata['audience']}")
        md_lines.append(f"- **Duration**: {metadata['duration_minutes']} minutes")
        md_lines.append(f"- **Estimated Slides**: {metadata['estimated_slides']}")
        md_lines.append(f"- **Style**: {metadata['style']}")
        md_lines.append(f"- **Generated**: {metadata['generated_date']}")
        md_lines.append("")
        
        # Timing Summary
        total_seconds = sum(slide['estimated_time_seconds'] for slide in slides)
        md_lines.append("## Timing Summary")
        md_lines.append(f"- **Total presentation time**: {total_seconds // 60}:{total_seconds % 60:02d}")
        md_lines.append(f"- **Average per slide**: {total_seconds // len(slides)} seconds")
        md_lines.append("")
        
        # Slides
        md_lines.append("## Slide-by-Slide Outline")
        md_lines.append("")
        
        for slide in slides:
            md_lines.append(f"### Slide {slide['slide_number']}: {slide['title']}")
            md_lines.append(f"- **Estimated time**: {slide['estimated_time_seconds']} seconds")
            md_lines.append("")
            
            md_lines.append("#### Content Suggestions:")
            for suggestion in slide['content_suggestions']:
                md_lines.append(f"- {suggestion}")
            md_lines.append("")
            
            md_lines.append("#### Visual Suggestions:")
            for visual in slide['visual_suggestions']:
                md_lines.append(f"- {visual}")
            md_lines.append("")
            
            md_lines.append("#### Speaker Notes:")
            for note in slide['speaker_notes']:
                md_lines.append(f"- {note}")
            md_lines.append("")
        
        # Design Guidelines
        md_lines.append("## Design Guidelines")
        md_lines.append("")
        md_lines.append("### Color Scheme")
        md_lines.append("- **Primary color**: Choose based on topic/brand")
        md_lines.append("- **Secondary color**: Complementary accent")
        md_lines.append("- **Text color**: High contrast for readability")
        md_lines.append("")
        
        md_lines.append("### Fonts")
        md_lines.append("- **Headers**: Clear, bold font (e.g., Arial Black, Helvetica Neue)")
        md_lines.append("- **Body text**: Readable sans-serif (e.g., Arial, Calibri)")
        md_lines.append("- **Sizes**: Minimum 24pt for body, 32pt+ for headers")
        md_lines.append("")
        
        md_lines.append("### Layout Principles")
        md_lines.append("- **One idea per slide**")
        md_lines.append("- **Use visuals over text**")
        md_lines.append("- **Consistent formatting throughout**")
        md_lines.append("- **Adequate white space**")
        md_lines.append("")
        
        md_lines.append("### Image Sources")
        md_lines.append("- **Unsplash**: Free high-quality photos")
        md_lines.append("- **Pixabay**: Free illustrations and vectors")
        md_lines.append("- **NASA Image Library**: Space/science images")
        md_lines.append("- **Company/Organization assets**: Logos, branded images")
        md_lines.append("")
        
        # Presentation Tips
        md_lines.append("## Presentation Tips")
        md_lines.append("")
        md_lines.append("### Before Presentation")
        md_lines.append("- Practice timing with a timer")
        md_lines.append("- Test all technology and backups")
        md_lines.append("- Prepare handouts if needed")
        md_lines.append("- Arrive early to set up")
        md_lines.append("")
        
        md_lines.append("### During Presentation")
        md_lines.append("- Speak clearly and at moderate pace")
        md_lines.append("- Maintain eye contact with audience")
        md_lines.append("- Use gestures naturally")
        md_lines.append("- Check for understanding")
        md_lines.append("")
        
        md_lines.append("### Handling Q&A")
        md_lines.append("- Listen carefully to each question")
        md_lines.append("- Repeat question for everyone")
        md_lines.append("- Answer concisely")
        md_lines.append("- Admit when you don't know, offer to follow up")
        md_lines.append("")
        
        return "\n".join(md_lines)


def main():
    parser = argparse.ArgumentParser(description="Generate PowerPoint presentation outlines")
    parser.add_argument("topic", help="Presentation topic")
    parser.add_argument("--template", "-t", default="simple", 
                       choices=["simple", "educational", "business", "technical"],
                       help="Presentation template type")
    parser.add_argument("--duration", "-d", type=int, default=10,
                       help="Presentation duration in minutes")
    parser.add_argument("--audience", "-a", default="general",
                       help="Target audience")
    parser.add_argument("--format", "-f", default="markdown",
                       choices=["markdown", "json"],
                       help="Output format")
    parser.add_argument("--output", "-o", 
                       help="Output file (default: auto-generated)")
    
    args = parser.parse_args()
    
    generator = PPTOutlineGenerator()
    
    try:
        print(f"Generating outline for: {args.topic}")
        print(f"Template: {args.template}, Duration: {args.duration}min, Audience: {args.audience}")
        
        outline = generator.generate_outline(
            topic=args.topic,
            template_type=args.template,
            duration_minutes=args.duration,
            audience=args.audience
        )
        
        output_file = generator.save_outline(
            outline=outline,
            format=args.format,
            output_file=args.output
        )
        
        print(f"\n✅ Outline generated successfully!")
        print(f"📄 Saved to: {output_file}")
        print(f"📊 Slides: {len(outline['slides'])}")
        
        # Show quick preview
        if args.format == "markdown":
            print("\n📋 Quick Preview:")
            print(f"1. {outline['slides'][0]['title']}")
            if len(outline['slides']) > 1:
                print(f"2. {outline['slides'][1]['title']}")
            if len(outline['slides']) > 2:
                print(f"3. {outline['slides'][2]['title']}")
            print(f"...")
            print(f"{len(outline['slides'])}. {outline['slides'][-1]['title']}")
        
    except Exception as e:
        print(f"❌ Error generating outline: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
import { LogicEditorEdge, LogicEditorNode } from '@buildweaver/libs';
import { IsArray } from 'class-validator';

export class SaveProjectGraphDto {
  @IsArray()
  nodes!: LogicEditorNode[];

  @IsArray()
  edges!: LogicEditorEdge[];
}

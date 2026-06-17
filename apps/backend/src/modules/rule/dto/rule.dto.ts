import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TierDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  tier!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  minPct!: number;

  @ApiPropertyOptional({ example: 10, type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  maxPct!: number | null;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  count!: number;
}

export class TierConfigDto {
  @ApiProperty({ type: [TierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  tiers!: TierDto[];
}

export class CreateRoomRuleDto {
  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(1)
  @Max(600)
  focusMin!: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(120)
  breakMin!: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(20)
  rounds!: number;

  @ApiProperty({ example: ['노래 부르기', '커피 사기'] })
  @IsArray()
  @ArrayMaxSize(100)
  @MaxLength(50, { each: true })
  @IsString({ each: true })
  penalties!: string[];

  @ApiProperty({ type: TierConfigDto })
  @ValidateNested()
  @Type(() => TierConfigDto)
  tierConfig!: TierConfigDto;
}

export class SaveRuleTemplateDto extends CreateRoomRuleDto {
  @ApiProperty({ example: '지옥의 뽀모도로' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  title!: string;
}
